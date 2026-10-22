# Rencana Pengembangan — lacakedu (root + sekolah)

Status: **RANCANGAN (belum diimplementasikan)** · Tanggal: 2026-10-21
Dasar: audit keamanan & performa (`docs/security-audit-2026-10-21.md`) + pemetaan kode repo.

## Keputusan yang sudah diambil (2026-10-21)

1. **EPUB reader in-app** — pakai `epubjs` (±300KB) di reader in-app. PDF via `<iframe sandbox>`, markdown dirender sebagai React element.
2. **Root mengedit langsung ke `SchoolSettings`** — tanpa tabel override terpisah. Simpler: perubahan root langsung terlihat di sekolah. Riwayat tetap ada di `AuditLog` (aksi `ROOT.SCHOOL_SETTINGS_UPDATE`).
3. **Statistik view — TOTAL per hari** (dipilih 22 Okt 2026). Satu baris per konten per hari di
   `ContentView`, di-upsert per event view. Tidak ada hitungan unik per hari (biaya jauh lebih
   tinggi); pembeda "unloading" tidak dipakai. Sisa query view per hari cukup satu baris.
4. **Lingkup QA — bisa dipilih** — pilihan cakupan di UI/jalur QA: (a) 1 sekolah + 1 sekolah kedua (paling cepat, cukup untuk uji isolasi), (b) semua sekolah demo.
5. **Gambar karakter — per sekolah DAN boleh custom** — tiap sekolah punya ilustrasi sendiri;]="(default dari aset) atau gambar custom yang diunggah admin sekolah (dan bisa ditimpa root). Default: ilustrasi per kategori sekolah, custom: upload PNG/JPG/WEBP ≤ 2MB.

## Prinsip & batasan yang tidak boleh dilanggar

1. **Dua level admin, tetap terpisah**
   - `SUPER_ADMIN` (root): satu akun, akses lintas sekolah lewat koneksi `app_root` (BYPASSRLS) — hanya untuk route `/api/root/*`.
   - `ADMIN` (sekolah): akses tenant lewat `runAsSchool` (RLS aktif). Tidak boleh bisa menyentuh data sekolah lain.
2. **TAdditionyal baru = ringan.** Tidak menambah library berat. Chart pakai `chart.js` (sudah terpasang) atau SVG handmade seperti yang sudah ada.
3. **Semua upload lewat helper yang sudah ada** (`apps/web/server/files.ts` + `server/images.ts`): magic bytes, batas ukuran, nama acak, anti path-traversal. Jangan buat pola upload keempat.
4. **Migrasi DB lewat file migrasi** di `packages/db/prisma/migrations/` (RootSettings & tabel baru), dan **diterapkan manual ke DB live** seperti migrasi RPC sebelumnya.
5. **Deploy** tetap `bash scripts/deploy.sh` (build di VPS, load image, restart, verifikasi). Tidak ada langkah manual tambahan.
6. Tidak mengubah halaman login sekolah (sudah di-revert ke desain asli) kecuali diminta.

---

## Fase 0 — Perbaikan cepat (2–3 jam, tinggi dampak)

| # | Item | Why |.where |
|---|---|---|---|
| 0.1 | **Route toggle aktif user root** (`POST /api/root/users/{id}/active`) tidak ada → UI `/pantau/users` pasti 404 | Fitur mati total | `apps/web/app/api/root/users/[id]/active/route.ts` (baru) |
| 0.2 | **Chart "Kehadiran 30 hari" salah data** — `byDay` dihitung dari `User.createdAt`, bukan absensi | Angka displayed menyesatkan | `apps/web/app/api/root/analytics/route.ts:32-36` + `pantau/dashboard/page.tsx:117-124` |
| 0.3 | Tampilkan field yang sudah dihitung tapi tak pernah dipakai: `attendance`, `leaveRequest`, `announcement` | Data ada, UI tak pakai | `pantau/dashboard/page.tsx` |
| 0.4 | Gabungkan pola upload yang terduplikasi 3× (hero/logo/avatar) jadi satu helper `saveBrandImage()` | 3 salinan logic, risk beda | `apps/web/server/images.ts` |

**Selesai kalau:** toggle aktif user root working di UI; kartu dashboard root menampilkan angka absensi/izin/pengumuman yang benar.

---

## Fase 1 — Fondasi data (1–2 hari) — **SELESAI 22 Okt 2026**

> Terpasang: migrasi `20261022120000_book_contentview_school_branding` (tabel `Book`, `ContentView`,
> 5 kolom branding di `SchoolSettings`), RLS per sekolah, dan terverifikasi: tenant hanya
> melihat buku sekolahnya, tenant **diblokir** membuat buku platform, `app_root` melihat semua.

### 1.1 Model `Book` (ebook) — belum ada sama sekali
```
model Book {
  id        String   @id @default(cuid())
  schoolId  String            // NULL = buku platform (root)
  title     String
  author    String?
  coverUrl  String?
  source    BookSource        // LINK | UPLOAD | MARKDOWN
  url       String?           // untuk LINK
  fileKey   String?           // untuk UPLOAD (relatif ke UPLOADS_ROOT)
  bodyMd    String?           // untuk MARKDOWN (teks yang dipaste)
  mimeType  String?
  sizeBytes Int?
  published Boolean  @default(false)
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([schoolId, published])
}
enum BookSource { LINK UPLOAD MARKDOWN }
```
> Katalog buku sekarang **100% proxy Internet Archive** (`api/portal/search-books`, `api/portal/popular-books`) — tidak ada data buku di DB. Model ini membuat katalog internal bisa berdampingan (sumber: `internal` | `archive`).

### 1.2 Tabel penghitung view/pembacaan — **Selesai: `ContentView` (total per hari)**
```
model ContentView {
  id       String   @id @default(cuid())
  schoolId String
  kind     String   @db.VarChar(32)   // BOOK | MATERIAL | TASK | ANNOUNCEMENT | PORTAL
  entityId String   @db.VarChar(64)
  day      DateTime @db.Date
  count    Int      @default(0)
  @@unique([schoolId, kind, entityId, day])
  @@index([schoolId, day])
}
```
Event view dikirim `POST /api/track/view` (publik, tanpa auth, limiter Redis), ditulis dengan
upsert `ON CONFLICT DO UPDATE count = count + 1`. Kalau yang tercatat total per hari, tidak
perlu tabel terpisah — satu baris per konten per hari cukup.

### 1.3 Pengaturan per-sekolah yang bisa diedit root — **Kolom sudah ada di `SchoolSettings`**
Kolom baru (terpasang 22 Okt 2026): `characterImageUrl`, `heroImageUrl`, `dashboardBannerUrl`,
`brandColor`, `portalTheme` (default `"default"`). API untuk menulisnya menyusul di Fase 2.

| Key | Jenis | Default | Edit oleh |
|---|---|---|---|
| `heroImageUrl` | teks | null | root & admin sekolah |
| `characterImageUrl` | teks | `/assets/student-book.png` | root & admin sekolah |
| `brandColor` | hex | null (pakai token default) | root & admin sekolah |
| `dashboardBannerUrl` | teks | null | root & admin sekolah |
| `portalTheme` | enum | default | root |

> Prinsip: **root boleh mengedit apa pun di sekolah; admin sekolah boleh mengedit subset miliknya.** Superset = school override root, dan nilai override ditandai (`overriddenByRoot: true`) supaya admin tahu.

### 1.4 Root settings perluasan
`RootSettings` (tabel SQL mentah) menambah key: `platformTagline`, `platformLogoUrl`, `primaryColor`, `supportEmail`, `defaultHeroImageUrl`, `featureFlags` (JSON: modul apa yang aktif), `announcementBanner`.

---

## Fase 2 — API & hak akses (2–3 hari)

### 2.1 Root mengedit sekolah (`/api/root/schools/[id]`)
```
GET    /api/root/schools/[id]        -> detail sekolah + settings + override
PATCH  /api/root/schools/[id]        -> ubah settings sekolah (role SUPER_ADMIN)
```
- `requireRole({roles:["SUPER_ADMIN"]})`, data lewat `getRootDb()`.
- Terapkan **field-level allowlist** (hanya key yang ada di allowlist tabel 1.3 yang boleh ditulis) → root tidak bisa menulis field tenant sembarangan.
- Semua perubahan dicatat ke `AuditLog` dengan `action = "ROOT.SCHOOL_SETTINGS_UPDATE"` (konsol `/pantau/logs` sudah bisa menampilkannya).

### 2.2 Root mengoverride satu sekolah tanpa mengubah school aslinya
`POST /api/root/schools/[id]/override` → simpan ke tabel override; `DELETE` untuk melepas override. school listing menampilkan badge "di-override root".

### 2.3 API buku (school-scoped)
```
GET    /api/books?scope=school|platform&q=&page=
POST   /api/books                 (LINK: {title,url,author,coverUrl})
POST   /api/books/upload          (multipart file: pdf/epub/docx/md, ≤ 25MB)
POST   /api/books/markdown        ({title, bodyMd})
PATCH  /api/books/[id]            (edit metadata, publish/unpublish)
DELETE /api/books/[id]
GET    /api/books/[id]/file       (streaming PDF/EPUB, Range, nosniff)
GET    /api/books/[id]/read       (reader: markdown aman / preview PDF)
POST   /api/books/[id]/view       (hitung view; rate-limited)
```
- Scope: `schoolId` dari sesi; buku platform (`schoolId = null`) dibaca semua sekolah.
- Upload ebook: **jangan** pakai `files.ts` submission (batas 8MB & whitelist tipe) — buat allowlist sendiri: `pdf, epub, docx, md`, ≤ 25MB, magic bytes dicek, nama acak, path `$UPLOADS_ROOT/<schoolId>/books/`.
- Markdown: sanitasi (tanpa `dangerouslySetInnerHTML`; pakai sanitizer yang sudah dipakai repo) dan batasi panjang (mis. 500 KB).

### 2.4 API tracking view
`POST /api/track/view` — payload `{kind, entityId}`; limiter Redis `rl:view:<ip>` 60/menit; server memvalidasi `entityId` milik sekolah sesi (atau buku platform).

### 2.5 Keamanan yang wajib ada di endpoint baru
- Semua mutasi: `requireRole`/`apiGate` → `originOk()` + `csrfOk()`.
- Semua query: RLS tenant (`runAsSchool`) atau root client untuk `/api/root/*`.
- Semua file: `safeFilePath`/nama acak + `nosniff` + `Content-Disposition` untuk ebook yang bisa dieksekusi.
- Halaman reader ebook tidak boleh menjadi XSS: markdown → React element (bukan `dangerouslySetInnerHTML`), PDF via `<iframe sandbox>`.

---

## Fase 3 — Dashboard root lengkap (2–3 hari)

Grafik: pakai `chart.js` (sudah terpasang, contoh: `apps/web/components/AssessChart.tsx`) — buat satu komponen generik `ChartCard` supaya konsisten.

| Grafik | Sumber | Catatan |
|---|---|---|
| **Absensi harian 30 hari** (bukan user baru) | `Attendance` join `School` | ganti `byDay` yang salah |
| **Tren siswa baru** | `User.createdAt` (data lama) | pindahkan ke kartu terpisah agar tidak disalahartikan |
| **Kehadiran per sekolah** (bar) | agregasi per `schoolId` | paging / top-N |
| **Izin siswa** (line/area) | `LeaveRequest` per status | sudah dihitung, belum divisualkan |
| **Penggunaan fitur** (donut) | jumlah tugas/submission/asesmen/materi/ebook per sekolah | |
| **View ebook/materi** (bar) | `ContentView` (rollup harian) | sumber dari 1.2 |
| **Antrean WA** | `WaOutbox` status | mengukur beban operasional |
| **Sekolah aktif vs nonaktif** | `School.isActive` | filter cepat |

Semua grafik: rentang waktu 7/30/90 hari, filter per sekolah, export CSV (manfaat nyata untuk kepala sekolah/dinas), dan **wajib** di-cache (`unstable_cache` 60 dtk) karena render dashboard berat.

API: `GET /api/root/analytics?range=30&schoolId=` mengembalikan agregat siap-plot (bukan SQL mentah ke client).

---

## Fase 4 — Setelan root (1–2 hari)

Halaman `/pantau/settings` diperluas:
- **Identitas platform**: nama, tagline, logo platform, email dukungan, warna utama.
- **Hero & banner**: upload (sudah ada `POST /api/root/settings/hero`) +Dimensions/kedalaman.
- **Fitur**: toggle modul (AI chat, WA broadcast, ebook, absensi QR, import siswa) per platform.
- **Default sekolah**: template setelan yang dipakai sekolah baru.
- **Preview**: lihat landing `/beranda` sepertiQM галерея visitor.
- Semua perubahan → `revalidatePath("/beranda")` (memakai API purge) supaya landing ikut terupdate.

---

## Fase 5 — Branding & konten sekolah (2–3 hari)

1. **Ganti gambar karakter dashboard sekolah** (saat ini hardcoded `src="/assets/student-book.png"` di `apps/web/app/(dash)/admin/dashboard.tsx:48`):
   - Kolom baru `SchoolSettings.characterImageUrl`; upload via `POST /api/settings/character` (pola `api/settings/logo` yang sudah ada: PNG/JPG/WEBP ≤ 2MB, magic bytes, nama acak → `$UPLOADS_ROOT/<schoolId>/branding/`).
   - Fallback ke aset default bila kosong.
   - Berlaku untuk: dashboard admin, dashboard guru, dashboard siswa, halaman login sekolah.
2. **Foto/logo sekolah**: `logoUrl` sudah ada → perbaiki tampilannya (ukuran, crop, fallback) + dukungan **warna brand** (`brandColor` → CSS variable, bukan hex hardcoded).
3. **Galeri foto sekolah** (opsional): `SchoolGallery` (upload multi, reorder, hapus, pakai untuk banner dashboard).
4. **Hero landing sekolah**: memakai `heroImageUrl` per sekolah, dengan default hero platform.

---

## Fase 6 — Fitur ebook (3–5 hari)

**Tampilan**
- Halaman `/buku` menjadi dua tab: **Katalog平台** (buku internal: link/upload/markdown) dan **Open Library** (proxy Internet Archive yang sudah ada, dipertahankan).
- Reader in-app: markdown dirender aman; PDF lewat `<iframe>`; EPUB butuh viewer JS (evaluasi: `epubjs` ± 300KB — aceitabl, atau sebagai fase terpisah).
- Filter & pencarian: judul, author, sumber, tanggal; pagination server-side (tidak seperti sekarang yang fetch semua).

**Kelola (admin sekolah + root)**
- Tambah via **link** (URL + judul + author + cover) → server menyimpan metadata; opsi "scrape" judul dari URL (opsional, SSRF harus diblokir: hanya `http/https`, blok IP privat/link-local/metadata AWS).
- Tambah via **upload file** (pdf/epub/docx/md ≤ 25MB, magic bytes, antivirus optional).
- Tambah via **paste teks/markdown** (paste dari Word/Google Docs → markdown, sanitasi, simpan `bodyMd`).
- Edit metadata, publish/unpublish, hapus (soft delete → arsip), pin ke atas.
- Kuota: jumlah buku & total ukuran per sekolah (biaya storage) → tampil di setelan sekolah.

**Risiko**
- Penyimpanan file di volume `systemd-uploads` (7 file sekarang) —ebook besar eats space; perlu kuota + monitoring disk (disk host sudah pernah 97%).
- SSRF saat scrape URL: whitelist skema, blok `127.0.0.0/8`, `10/8`, `169.254/16`, `::1`, dan hanya timeout pendek.

---

## Fase 7 — QA: tes semua fitur (2–3 hari)

Matrix pengujian (manual + otomatis) untuk **setiap** fitur, di 3 host (apex root, `<slug>.lacakedu.web.id` sekolah, dan subdomain kedua untuk uji isolasi):

**A. Autentikasi & otorisasi**
- Login sekolah (email & NISN), login root, session persisten, logout, ganti password, `mustChangePassword`, cookie di subdomain lain.
- **Isolasi sekolah**: user sekolah A tidak bisa akses (langsung maupun IDOR) data sekolah B — cek tiap endpoint `/api/*` dengan user A.
- Root tidak bisa menyebut endpoint tenant tanpa RLS.

**B. Absensi** — scan QR (valid/expired/duplikat), absensi manual, cutoff, kalender, bulk, export.

**C. Tugas & materi** — buat tugas, lampirkan materi (upload > 8MB!), siswa submit + upload, guru beri nilai, rapor, remix, tenggat, notifikasi.

**D. AI chat** — aktif/nonaktif, rate limit tamu, streaming, riwayat.

**E. WhatsApp** — pairing (scan QR), kirim broadcast, antrean, retry, kuota harian, status per sekolah.

**F. Import siswa** — upload CSV/XLSX, validasi, error per baris, kredensial, log.

**G. Anonim & collaborate** — kirim pesan, thread, balas, rate limit, batas panjang.

**H. File** — avatar, logo, ebook, materi: validasi tipe, batas ukuran, path traversal, file >8MB (regresi fix `appendFile`).

**I. Dashboard & grafik** — akurasi angka vs data mentah, filter rentang, CSV export, cache invalidation setelah ubah data.

**J. Performa** — load test tiap halaman utama (target p95 < 500 ms di origin), memory worker web < 1 GB, tidak ada kebocoran memory di limiter (fix `anonim`).

**K. Keamanan (regression)** — jalankan ulang: nuclei 6.501 template, testssl, probe spoofing XFF, uji path traversal, uji alias dev (harus 404 di produksi), uji cookie lintas subdomain.

**L. Deploy & operasional** — `scripts/deploy.sh` dari commit bersih, reboot VPS (semua service autostart), backup `pg_dump` + restore ke DB kosong, rotasi password & `INTERNAL_TOKEN`.

> Prasyarat QA: akun uji yang bisa login untuk tiap role (sekolah: `admin@demo.sch.id`, `guru@demo.sch.id`, `andi@demo.sch.id`; siswa: perlu reset password) dan **subdomain sekolah kedua** untuk uji isolasi data (sekarang baru ada `smansa`).

---

## Fase 8 — Rebranding menyeluruh: "sms-lms" → "lacakedu"

Status: **dimulai 22 Okt 2026** · Inventaris lengkap: `docs/rebrand-inventory.md`
(±602 baris "sms" di 223 file; repo, infra, dan domain sudah pakai "lacakedu" —
yang tersisa terutama di teks UI, scope paket, dan identifier internal).

### Batch & urutan (paling aman → paling berisiko)
| Batch | Isi | Perkiraan | Status |
|---|---|---|---|
| **1. Teks UI** | 22 kemunculan / 17 file: wordmark `Logo.tsx`, judul `layout.tsx`, `manifest.webmanifest`, landing `/beranda`, `PortalHome`, header `/pantau`, judul `/perkakas/*`, teks kartu QR siswa, `User-Agent` fetch, komentar panduan AI | 30 menit | ✅ selesai 22 Okt |
| **2. Scope paket** | `@sms/*` → `@lacakedu/*` (492 import / 182 file) + `bin: sms-admin` → `lacakedu-admin` + filter pnpm di Containerfile + `scripts/lint-imports.sh` + regenerate `pnpm-lock.yaml` | 1–2 jam | ✅ selesai 22 Okt |
| **3. Identifier internal** | env `SMS_COOKIE_*` → `LACAKEDU_COOKIE_*` (dengan fallback), cookie dev `lacakedu-session-dev`, cache `lacakedu-shell-v2`/`lacakedu-tts`, container dev `lacakedu-test-*` | 1 jam | ✅ selesai 22 Okt |
| **4. Server-side (ops)** | DB `smsdb` → `lacakedudb`, role kerja Postgres `lacakedu` (superuser), role bootstrap `sms` → `lacakedu_sys` (tak bisa di-drop: pemilik katalog sistem), path backup `/var/backups/lacakedu`, env + healthcheck + scripts/docs | 2–3 jam | ✅ selesai 22 Okt (backup + uji restore dulu) |
| **5. Prefix token QR** | `sms1-` → `lac1-`, scanner dual-accept `/^(sms1\|lac1)-[0-9a-f]{32}$/`; validasi server tetap lookup DB (tanpa aturan prefix) → QR lama tetap valid | 1 jam | ✅ selesai 22 Okt |
| **6. Path folder lokal** | `/home/revy/Projects/me/sms-lms` → `/home/revy/Projects/me/lacakedu` (5 file + symlink workspace `node_modules/@lacakedu/*`) | 15 menit | ✅ selesai 22 Okt |

### Yang TIDAK boleh diganti
- **"SMS" sebagai Short Message Service** (broadcast WhatsApp, "tidak ada SMS/email cadangan") — bukan brand.
- Migration SQL yang **sudah ter-apply** (checksum Prisma) — ubah lewat `UPDATE` data, jangan edit file migration lama. Contoh: `platformName='SMS-LMS'` → sudah di-`UPDATE` live menjadi `"Lacakedu"`.
- Nama kolom/tabel yang sudah berisi data (prefix QR di atas).

### Verifikasi tiap batch
- typecheck `tsc --noEmit` (web, shared, db) + build di VPS via `scripts/deploy.sh`
- `grep -rn "@sms/"` harus kosong; `grep -rn "SMS-LMS"` harus kosong
- cek visual: landing `/beranda`, header `/pantau`, PWA manifest, kartu QR siswa
- smoke test: login root, login sekolah, dashboard, buku, upload

---

## Urutan pengerjaan & dependensi

```
Fase 0 (fix cepat)  ─┐
Fase 1 (model)     ─┼─► Fase 2 (API) ─► Fase 3 (dashboard root)
Fase 4 (setelan root) ─┘                 Fase 5 (branding) ─► Fase 6 (ebook)
                                                        └────► Fase 7 (QA menyeluruh)
```
- Fase 1.2 (view counter) perlu dulu sebelum Fase 3 (grafik view).
- Fase 1.3 perlu dulu sebelum Fase 2.1 & 5.
- Fase 6ebook butuh 1.1 + 2.3.
- Fase 5 (ganti gambar karakter) tidak bergantung ebook → bisa paralel.

## Estimasi kasar (1 developer, familiar dengan repo)
Fase 0: 0,5 hari · Fase 1: 1,5 hari · Fase 2: 2,5 hari · Fase 3: 2,5 hari · Fase 4: 1,5 hari · Fase 5: 2,5 hari · Fase 6: 4 hari · Fase 7: 3 hari → **± 18 hari kerja**.

## Yang perlu diputuskan sebelum mulai
1. **Ebook**: EPUB reader in-app (tambah dependensi ~300KB) atau PDF + markdown saja dulu?
2. **Override root**: root mengedit langsung ke `SchoolSettings` (sederhana,riwayat hilang) atau tabel override terpisah (riwayat jelas,Sedikit lebih)?
3. **Statistik view**:全会 jumlah view, atau view unik per hari? ( unik jauh lebih mahal)
4. **Lingkup "semua fitur"** di Fase 7: cukup 1 sekolah + 1 sekolah kedua, atau semua sekolah demo?
5. **Gambar karakter**: ilustrasi ثابت per sekolah, atau karakter humanoid/custom per sekolah (butuh generator/editor)?
