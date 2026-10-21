# Laporan Audit Keamanan & Performa — lacakedu.web.id

Tanggal: 2026-10-21 · Target: `https://lacakedu.web.id` (tunnel Cloudflare) + origin `http://139.190.103.107:8090` (listener tes sementara)
Metode: review kode (agent), nmap, nuclei 6.501 template × 44.000+ request, testssl.sh, probe manual curl, load test.

## Ringkasan

| Area | Hasil |
|---|---|
| nuclei (6.501 template, 3 target) | **0 temuan** |
| nmap full port scan | hanya **22/SSH** + 8090 (listener tes) terbuka publik |
| Review kode auth | 1 HIGH (rate-limit bypass), 3 MEDIUM, 1 LOW — **sudah diperbaiki** |
| Cloudflare Free | WAF custom rules (403) + rate limit 5/10 dtk (429) — **aktif & terverifikasi** |
| Kerentanan yang bisa dieksploitasi tanpa auth | **tidak ditemukan** |

Semua temuan yang bisa dieksploitasi sudah diperbaiki dan diverifikasi ulang di server live (lihat "Perbaikan yang diterapkan").

---

## Temuan (semua sudah diperbaiki, kecuali yang ditandai)

### [HIGH] Rate limit login bisa dielakkan dengan memalsukan `X-Forwarded-For`
- **Penyebab:** `apps/web/server/request-ip.ts` mengambil XFF *kiri-terpaling* (dianggap IP klien asli), dan nginx **tidak pernah menulis ulang** XFF → nilai dari klien diteruskan apa adanya. Cloudflare juga meneruskan XFF kiriman klien.
- **Bukti (sebelum fix):** 3 request dengan XFF palsu membuat key rate-limit `rl:login:ip:198.51.100.7/8/9` — limiter per-IP jadi tak berguna. Yang tersisa hanya batas per-akun 5/300 dtk.
- **Perbaikan:** nginx `proxy_set_header X-Forwarded-For $remote_addr;` (dan `X-Real-IP` sudah ada); `ipOf()` kini memakai `x-real-ip` (dikontrol nginx) lebih dulu.
- **Verifikasi (sesudah fix):** request dengan XFF `198.51.100.77/88` → key terbentuk `rl:login:ip:103.189.207.244` (IP asli). Spoofing netral.

### [MEDIUM] `/api/anonim` — unbounded memory + payload tanpa batas
- **Penyebab:** limiter in-memory `Map ipHits` tidak pernah menghapus entri (setiap IP baru = entri permanen) → pertumbuhan memori tanpa batas (OOM); `subject`/`message` tanpa batas panjang.
- **Perbaikan:** limiter dipindah ke Redis (`hit("rl:anonim:<schoolId>:<ip>", 5, 3600)`), `subject` ≤ 200, `message` ≤ 2000 karakter.
- **Verifikasi:** message 3000 char → **400**; subject 300 char → **400**; key Redis terbentuk.

### [MEDIUM] `/api/ai/chat` — kuota tamu hanya per-IP (dapat dipalsukan)
- **Perbaikan:** ditambah kuota global harian per sekolah `rl:ai:guest:<schoolId>` (300/hari) memakai limiter Redis, di atas batas per-IP.
- **Catatan:** hanya aktif bila `AI_CHAT_ENABLED=true`.

### [MEDIUM] Alias domain dev dipercaya di produksi
- **Penyebab:** `dev.revy.my.id`, `revy.my.id`, `localtest.me` dianggap apex/root host dan di-whitelist untuk `Origin` mutasi — tanpa cek `NODE_ENV`. Kalau domain itu someday pointing ke pihak lain, jalur origin & console root bisa bocor.
- **Perbaikan:** helper baru `isRootHost()` di `packages/shared/src/school.ts` — alias dev hanya aktif bila `NODE_ENV !== "production"`; `originOk()` dan cabang apex `authorize()` memakai aturan sama.
- **Verifikasi:** `Host: dev.revy.my.id` → **404**; `Host: localtest.me` → **404**; `Host: lacakedu.web.id` → 307 (normal).

### [LOW] Percobaan login SUPER_ADMIN tidak punya jejak forensik
- **Penyebab:** akun root tidak punya sekolah (`schoolId=""`), sedangkan `AuditLog` punya FK `schoolId` NOT NULL → gagal login root tak pernah tercatat.
- **Perbaikan:** tabel baru `RootAuthAttempt` (migrasi `20261021150000_root_auth_audit`), ditulis via koneksi root (`app_root`), ditampilkan lewat `GET /api/root/audit` → `rootAttempts[]`.
- **Verifikasi:** percobaan gagal & berhasil tercatat dengan IP asli.

### [LOW] Batas tebakan per akun terlalu longgar per jam
- **Perbaikan:** ditambah jendela jam per akun `rl:login:acct:hr:*` (20/jam) selain 5/300 dtk.

### [INFO] Bug损坏 data: upload > 8 MB tersimpan rusak (bukan security)
- `apps/web/server/files.ts` memakai `writeFile` untuk tiap chunk → men-truncate chunk sebelumnya; hanya chunk terakhir tersisa. Diganti `appendFile` untuk chunk setelah pertama.

---

## Area yang diperiksa dan AMAN

- **Otorisasi lintas host/sekolah:** sesi SUPER_ADMIN (`schoolId=""`, `sch="admin"`) ditolak di jalur sekolah; sesi sekolah ditolak di cabang apex. Cookie `__Host-` host-only + SameSite=Lax → replay lintas subdomain tidak mungkin. Semua `/api/root/*` memakai `requireRole({roles:["SUPER_ADMIN"]})`; `/pantau/*` dijaga server-side; proxy memberi 404 `/pantau` di subdomain sekolah.
- **Origin/CSRF:** mutasi mewajibkan `originOk()` (Origin atau Referer, `Origin: null` ditolak) + `csrfOk()` timing-safe. Tidak ada `Access-Control-Allow-Origin` yang memantulkan origin liar.
- **SQL injection:** nol `$queryRawUnsafe`/`$executeRawUnsafe`; semua `$queryRaw` berupa tagged template ter-parameterisasi.
- **IDOR/disclosure:** `/api/root/users` selalu mengecualikan role SUPER_ADMIN; response tenant dibatasi `runAsSchool`; tidak ada `dangerouslySetInnerHTML`.
- **Upload/path traversal:** nama file di-sanitasi (prefix hex + charset aman), tipe divalidasi magic bytes (SVG/HTML ditolak), `safeFilePath` memakai `basename` + prefix check, penyajian `nosniff`.
- **Port publik:** hanya SSH (22) + 8090 (listener tes, akan dicabut). Postgres/Redis/Next.js tidak terjangkau dari internet.
- **TLS:** terminating di Cloudflare (wildcard `*.lacakedu.web.id`, HSTS aktif).

---

## Risiko tersisa & rekomendasi

1. **PENTING — cabut listener tes 8090** (`deploy/quadlet/lacakedu-nginx.container` → `PublishPort=8090:8080` + blok `listen 8080` di `deploy/nginx/nginx.conf`). Selama aktif, origin bisa diakses tanpa Cloudflare (membypass WAF/DDoS). Jalur admin sudah ditutup (403) di listener itu, tapi tetap shouldn’t ada port publik tambahan.
2. **Rate limit berlapis & terverifikasi:** edge Cloudflare (5 request/10 dtk per IP → 429) + app (30/IP/mnt, 300/IP/jam, 5/akun/5mnt, 20/akun/jam → 429). Batas per-IP sengaja longgar agar siswa yang berbagi IP NAT (satu sekolah satu IP) tidak saling mengunci saat jam masuk; anti brute force bertumpu pada batas per-akun.
3. **Panel Cloudflare:** pastikan WAF/Managed Rules aktif dan Battening.
4. **Rahasia:** `admin@lacakedu.web.id` (SUPER_ADMIN) memakai password yang sudah dibagikan di chat/audit — **ganti password** dan rotasi `INTERNAL_TOKEN`, `app_root` & `app_user` password.
5. **Backup:** pastikan `pg_dump` harian berjalan (unit `backups-volume`) dan ada salinan off-VPS.

---

## Performa (hasil ukur)

### Latensi TTFB (halaman `/beranda`)
| Jalur | TTFB | Throughput (conc 20) | p50 | p95 |
|---|---|---|---|---|
| Origin langsung (via IP, tanpa CF) | **15–32 ms** | **46,8 req/s** | 293 ms | 1.310 ms |
| Lewat Cloudflare tunnel | **0,2–1,4 s** | **13,2 req/s** | 959 ms | 2.398 ms |

**Cloudflare menambah ~0,6–1,1 s dan menurunkan throughput ~3,5×** pada halaman dinamis.

### Penyebab
1. Tunnel: edge CF → `cloudflared` → nginx. RTT VPS→edge CF hanya 13,8 ms, tapi hop CF menambah ~0,6–1,1 s (terobservasi bimodal: sebagian 0,2 s, sebagian 1,1 s).
2. Koneksi tunnel terdaftar di 2 PoP: `sin13/sin14` **dan** `cgk03` (Kolkata) → permintaan yang dialokasikan ke PoP jauh menambah ~1 s. (Percobaan pin `--edge-ip` gagal: format flag tidak diterima cloudflared 2026.10.1 → tunnel sempat mati dan sempat menghasilkan HTTP 530; sudah dikembalikan ke kondisi awal.)
3. HTML dinamis selalu `cf-cache-status: DYNAMIC` → tiap kunjungan penetrate tunnel. Aset statis **sudah** cached di edge (`HIT`, age > 13 jam) — jadi bottleneck-nya bukan aset.

### Rekomendasi performa (urut impact)
1. **Cache HTML di edge** untuk halaman publik (`/beranda`, `/buku`, halaman legal): Cache Rules "Eligible for cache" + TTL 60–300 dtk, dan purge otomatis saat RootSettings berubah. Ini memotong sebagian besar latency tunnel.
2. **Tunnel:** coba `--edge-ip` dengan format yang benar (comma-separated: `--edge-ip 1.2.3.4,5.6.7.8`) agar semua koneksi ke PoP SIN; atau upgrade cloudflared 2026.10.1 → 2026.10.2.
3. **Cache render di app** (`unstable_cache`/`revalidate`) untuk `/beranda` — render saat ini ~20 ms tapi memonopoli 1 vCPU saat concurrency tinggi.
4. **Kalau kecepatan lebih penting dari WAF/DDoS:** arahkan DNS ke IP VPS dan sajikan nginx langsung di 443 (butuh sertifikat; setup acme sudah ada tapi belum ada sertifikat terbit). Trade-off: kehilangan WAF/DDoS CF dan membocorkan IP origin.
5. **Batas memori:** `lacakedu-web` memakai 367 MB saat render paralel; `MemoryMax` belum di-set untuk web → aman di 4 GB, tapi perlu diawasi.

---

# Probe Keamanan Manual (black-box) — 2026-10-21, 21:20–21:40 WIB

Target: `https://lacakedu.web.id` (apex), `https://smansa.lacakedu.web.id`, `http://139.190.103.107:8090` (listener tes, pasif saja).
Alat: `testssl.sh` (`--nodns none --ip 172.67.200.116`; mesin ini tak punya `dig`/`nslookup` → DNS-check testssl dilewati, TLS check tetap jalan) + `curl`.
Kredensial uji: SUPER_ADMIN `admin@lacakedu.web.id`. Total POST login gagal: **6** (dari batas 10); tidak ada brute force, tidak ada perubahan data.

> **Konteks penting:** selama audit berjalan, config di-deploy ulang — commit `41f4aa5` (21:27 WIB) dan `deploy/nginx/nginx.conf` diedit live (mtime 21:33 WIB, belum di-commit). Dua temuan header di bawah **sudah diperbaiki di tengah audit** dan wajib diverifikasi ulang.

## Temuan

### [MEDIUM → SUDAH DIPERBAIKI] Header keamanan terduplikat (nilai konflik) + HSTS tanpa `includeSubDomains`
- **Bukti (14:20–14:27 GMT, sebelum fix):**
  ```
  $ curl -sSI https://lacakedu.web.id/
  x-frame-options: SAMEORIGIN
  x-frame-options: DENY
  referrer-policy: strict-origin-when-cross-origin   (2x)
  x-content-type-options: nosniff                    (2x)
  strict-transport-security: max-age=63072000        (tanpa includeSubDomains)
  $ testssl: misconfiguration: X-Frame-Options 2x -- checking first one only
             HSTS_subdomains: only for this domain
  ```
- **Penyebab:** `deploy/nginx/nginx.conf:27-31` + `apps/web/next.config.ts:38-43` sama-sama mengirim header yang sama; `X-Frame-Options` malah beda nilai.
- **Dampak:** dua nilai `X-Frame-Options` yang konflik membuat sebagian browser **mengabaikan keduanya** (clickjacking bergantung CSP `frame-ancestors 'none'` yang masih ada → mitigasi terselamatkan), HSTS apex tidak mewariskan ke subdomain.
- **Bukti sesudah fix (14:33 GMT, live):**
  ```
  x-frame-options: DENY                     (1 salinan)
  strict-transport-security: max-age=63072000; includeSubDomains
  ```
  diff live: `proxy_hide_header X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy;` + `includeSubDomains`.
- **Saran:** commit perubahan `nginx.conf` itu, lalu **verifikasi ulang**; tambahkan HSTS preload (opsional) bila semua subdomain sudah HTTPS.

### [MEDIUM] Tidak ada redirect HTTP → HTTPS (port 80 menyajikan aplikasi penuh)
- **Bukti:**
  ```
  $ curl -sSI http://smansa.lacakedu.web.id/login      → HTTP/1.1 200 OK (halaman login)
  $ curl -sSI http://lacakedu.web.id/login             → 307 (location: /admin, bukan https://)
  $ curl -X POST http://lacakedu.web.id/api/auth/admin-login -d '{...}' → 401 (endpoint diproses)
  ```
- **Dampak:** kunjungan pertama lewat `http://` mengirim kredensial/kuki lintas jaringan tanpa TLS (HSTS baru efektif setelah sekali HTTPS).
- **Saran:** Cloudflare → SSL/TLS → **Always Use HTTPS** (atau *Full (strict)* + redirect), dan `return 301 https://$host$request_uri;` di blok `listen 80`.

### [LOW] Edge Cloudflare masih menerima TLS 1.0 / 1.1 → grade B
- **Bukti (testssl):**
  ```
  LOW  TLS1    offered (deprecated)
  LOW  TLS1_1  offered (deprecated)
  INFO grade_cap_reason_1: Grade capped to B. TLS 1.1 offered
  INFO grade_cap_reason_2: Grade capped to B. TLS 1.0 offered
  MEDIUM overall_grade: B
  ```
- **Dampak:** protokol legacy (BEAST/padding-oracle klasik) masih bisa dinegosiasiasi penyerang network.
- **Saran:** Cloudflare → SSL/TLS → **Minimum TLS version = 1.2** (zone `lacakedu.web.id`).

### [LOW] Cipher TLS 1.2 CBC + SHA-1 masih ditawarkan
- **Bukti:** `cipher-tls1_2_xc009/xc00a/xc023/xc024 = ECDHE-ECDSA-AES128-SHA, AES256-SHA, AES128-SHA256, AES256-SHA384`, `LOW cipherlist_OBSOLETED: offered`.
- **Dampak:** LUCKY13/BEAST (sangat sulit dieksploitasi praktis); FS sudah benar (ECDHE + `X25519MLKEM768`), TLS 1.3 hanya AEAD.
- **Saran:** di panel CF pilih preset cipher TLS 1.2 hanya-AEAD (GCM/ChaCha20); cukup jika ingin grade lebih tinggi.

### [LOW] Pembocoran identitas perangkat lunak: `X-Powered-By: Next.js` + `Server: nginx/1.30.6`
- **Bukti:**
  ```
  HTTPS via CF:  server: cloudflare            x-powered-by: Next.js
  Origin :8090:  Server: nginx/1.30.6          X-Powered-By: Next.js
  ```
- **Dampak:** enumerasi versi (nginx versi bocor) → penyerang bisa mencocokkan CVE; hanya terlihat langsung via IP (bukan via CF).
- **Saran:** `server_tokens off;` di `http{}` nginx + `proxy_hide_header X-Powered-By;` (Next: `poweredByHeader: false` di `next.config.ts`).

### [LOW] Listener tes `:8090` masih terbuka publik
- **Bukti:** `Server: nginx/1.30.6`, `GET /api/auth/me` → 200/401 dari app; jalur admin memang diblokir nginx:
  ```
  $ curl http://139.190.103.107:8090/api/root/schools → 403 nginx
  $ grep location deploy/nginx/nginx.conf:72  → ^/(pantau|admin|admin-login|api/auth/admin-login|api/root) return 403
  ```
- **Dampak:** origin bisa diakses tanpa Cloudflare (bypass WAF/DDoS/rate-limit edge) + bocor versi nginx. Blok `location /api/root` sudah bekerja.
- **Saran:** cabut `PublishPort` + blok `listen 8080` setelah uji selesai (sudah direkomendasikan di laporan atas).

### [INFO] `/api/push/vapid-public` → `503 {"error":"VAPID not configured"}`
- **Bukti:** `curl -sS https://lacakedu.web.id/api/push/vapid-public` → `503 {"error":"VAPID not configured"}`.
- **Dampak:** membocorkan status konfigurasi push (bukan rahasia); seharusnya 404/503 generik saat fitur mati.
- **Saran:** pesan generik (`not available`) atau 404 bila `VAPID` belum di-set.

## Area yang dicek dan AMAN (dengan bukti singkat)

| # | Uji | Hasil |
|---|---|---|
| 1 | **Cookie sesi** | `set-cookie: __Host-session=…; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800` — ada prefiks `__Host-`, **tanpa `Domain`** → browser tidak pernah mengirim lintas subdomain. |
| 2 | **Replay lintas host** | sesi root → `smansa/api/root/users` **401**, `smansa/api/auth/me` **401**, `smansa/api/students` **401**; sesi root → `apex/api/students` **403** (role). Ditolak ✓. Sesi milik sekolah tidak bisa dibuat (kredensial sekolah tidak dimiliki) — lihat "Batasan". |
| 3 | **Host-header spoof** | `SNI apex + Host: smansa` → `/api/root/users` **401**; kontrol `Host: apex` → **200** (bukti app membaca `Host`, bukan mengabaikan). `/pantau/dashboard` di subdomain → **404**; tanpa cookie → **307 /admin**. Origin 8090 memaksa `Host lacakedu.web.id` (nginx baris 79) sehingga spoof tidak mungkin di jalur itu. |
| 4 | **Cache poisoning** | semua respons API/halaman `cf-cache-status: DYNAMIC` (tidak ada cache edge utk konten dinamis → poisoning via `Host` tidak tersimpan). |
| 5 | **Path traversal** | `/api/root/files?path=/f=../../…` → **401** tanpa sesi, **200 `{"files":[]}`** dengan sesi (param **diabaikan**, ada di DB-manifest, bukan disk — *false positive bocor*); `/api/root/settings/hero?f=../../etc/passwd` → **404** (validasi regex `SAFE = /^[a-f0-9]{32}\.(png|jpg|webp)$/`); `/api/files/avatar/..%2f..%2f…` → **401/403**; `/%2e%2e/%2e%2e/etc/passwd` → **404**. Tidak ada yang 200 berisi file. |
| 6 | **IDOR / data lintas sekolah** | `GET /api/root/users?perPage=500` → `total 112` (106 SISWA + 5 GURU + 1 ADMIN, semua `smansa`), `has_SUPER_ADMIN = false` (akun root **tidak ikut terkirim**); `?role=SUPER_ADMIN` → **400 role tidak valid**; `?schoolId=sch-other-id` → `{"rows":[],"total":0}`. |
| 7 | **CORS** | `OPTIONS … Origin: https://evil.example` → **204 tanpa `Access-Control-Allow-Origin`** (browser akan memblokir); GET lintas origin ke `/api/root/users` & `/api/auth/me` → **tanpa ACAO**. Tidak ada pemantulan origin liar. |
| 8 | **Metode** | `TRACE /api/root/users` → **405** (nginx/CF, halaman default tanpa versi); `PUT/DELETE/PATCH` → **405** (Next, body kosong, tanpa stacktrace). |
| 9 | **Open redirect / header injection** | `/login?next=//evil.example` → **307 `location: /admin?next=%2F%2Fevil.example`** (path lokal, bukan eksternal); konsumen `next` hanya `apps/web/app/login/page.tsx:21-30` dengan `safeNext()` yang mewajibkan `/` tunggal dan menolak `//`, `http:`, `javascript:` → **tidak ada open redirect**. |
| 10 | **Unauthenticated `/api/root/*`** | GET: `/users /schools /settings /analytics /audit /files` → **401 `{"error":"unauthorized"}`**; POST: **405** (route GET-only), `POST /api/root/settings/hero` → **401**. Tidak ada satu pun 200. |
| 11 | **CSRF + origin mutasi** | `POST hero` tanpa `x-csrf-token` → **403**; dengan CSRF tapi `Origin: https://evil.example` → **403**; dengan CSRF + origin sah → **400** (validasi gambar, tidak ada upload). |
| 12 | **Enumerasi akun** | email tak dikenal & password salah → **401 identik** `"Email atau kata sandi salah"`; `super-login.ts` membakar `argon2.hash("dummy-burn")` untuk email tak dikenal → timing disamarkan. |
| 13 | **Rate limit nyata** | 6 percobaan login root gagal dari IP sama → **429 + `retry-after: 60`** pada percobaan ke-6 (batas 5/300 dtk per akun, 10/mnt per IP) → **berfungsi**. |
| 14 | **Enum path** | `/.git/HEAD`, `/.git/config`, `/.env`, `/package.json`, `/wp-login.php`, `/sitemap.xml`, `/.well-known/security.txt` → **404**; `/api/health` → `{"ok":true}` (tanpa data); `/api/public/schools` → `id, slug, name, url` 1 sekolah (wajar untuk portal, tanpa email/kredensial); `robots.txt` hanya boilerplate content-signals. |
| 15 | **Guard halaman root** | `/pantau/dashboard` & `/pantau/users` tanpa cookie → **307 /admin**, dengan sesi root → **200**; di host sekolah → **404**. |
| 16 | **Header wajib** | `Content-Security-Policy` (dengan nonce + `frame-ancestors 'none'`), `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, HSTS 730 hari kini + `includeSubDomains` → semua ada di apex **dan** smansa. |

## FALSE POSITIVE (jangan ditindaklanjuti)

1. **`OCSP_stapling: not offered` (testssl INFO)** — sertifikat tidak punya URL OCSP (`cert_ocspURL: --`), jadi tidak ada yang bisa di-staple; ujung TLS di Cloudflare. Bukan kerentanan.
2. **`BREACH` (MEDIUM)** — hanya "potentially vulnerable, br gzip" pada `/`; tidak ada rahasia (kukis/CSRF) yang direfleksikan di halaman uji. Risiko praktis nol untuk halaman tanpa data rahasia.
3. **`BEAST` (MEDIUM/LOW)** — testssl sendiri menandai `likely mitigated` karena TLS 1.1/1.2 tersedia; mitigasi ada di sisi klien. Yang perlu diperbaiki hanya Minimum TLS 1.2 (temuan terpisah).
4. **`engine_problem` (WARN)** — masalah lokal mesin audit (openssl GOST engine), bukan server.
5. **`/api/root/files?path=…` → 200** — *bukan bocor*: route tidak membaca `path`/`f`; daftar file berasal dari DB. Sama untuk `?role=SUPER_ADMIN` → 400 dan `schoolId` tak dikenal → 0 baris.
6. **Header duplikat + HSTS tanpa `includeSubDomains`** — valid saat diukur (14:20 GMT), **sudah diperbaiki live 14:33 GMT**. Jangan dilaporkan ulang tanpa ukur ulang.
7. **`TRACE → 405`** (bukan 405 aplikasi) — diblokir di edge, justru benar.
8. **Listener 8090 `POST /api/auth/admin-login`** → di blok nginx (403) untuk `api/root|pantau|admin*`, tetapi `admin-login` dicek di app → 404/401 sesuai Host; tidak ada jalur admin yang lolos.

## Batasan & risiko yang harus diketahui orchestrator

- **Replay lintas subdomain arah "sesi sekolah → apex" tidak bisa diuji**: tidak ada kredensial akun sekolah (login tenant dengan kredensial root → `401`), dan `admin-login` di host sekolah → `404`. Secara desain mustahil di browser (`__Host-` host-only + cek `schoolId`/`sch` di Redis), tapi **tidak diverifikasi empiris**.
- **IDOR lintas sekolah tidak bisa didemonstrasikan**: hanya ada 1 sekolah (`sch-demo-id` / smansa, 112 user).
- **Testssl tanpa DNS** (`--nodns none` + shim `dig` lokal): pemeriksaan CAA/DNSSEC/HSTS-preload-DNS tidak dijalankan; TLS protocol/cipher/header tidak terpengaruh.
- **Timing enumeration** diukur sekali saja (n=1: 1.20 dtk vs 1.82 dtk) → tidak simpul; pesan error identik, jadi enumerasi lewat pesan **tidak ada**.
- **Perubahan config di tengah audit** (`nginx.conf` live, belum di-commit) → seluruh temuan header wajib diukur ulang setelah commit.
- Rekomendasi laporan atas tetap berlaku: **ganti password root** (dibagikan di chat), cabut listener 8090, aktifkan WAF.
