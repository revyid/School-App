# Laporan Audit Keamanan & Performa — lacakedu.web.id

Tanggal: 2026-10-21 · Target: `https://lacakedu.web.id` (tunnel Cloudflare) + origin `http://139.190.103.107:8090` (listener tes sementara)
Metode: review kode (agent), nmap, nuclei 6.501 template × 44.000+ request, testssl.sh, probe manual curl, load test.

## Ringkasan

| Area | Hasil |
|---|---|
| nuclei (6.501 template, 3 target) | **0 temuan** |
| nmap full port scan | hanya **22/SSH** + 8090 (listener tes) terbuka publik |
| Review kode auth | 1 HIGH (rate-limit bypass), 3 MEDIUM, 1 LOW — **sudah diperbaiki** |
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
2. **Rate limit masih mengandalkan IP.** Setelah fix, XFF tak bisa dipalsukan, tapi penyerang dengan banyak IP asli tetap bisa mencoba. Batas per-akun (20/jam) yang sekarang menutup sebagian besar risiko.
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
