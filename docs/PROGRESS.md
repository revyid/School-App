# PROGRESS sms-lms (SATU server, SATU pod untuk semua sekolah)

## Fase 1 — Foundation (DONE, tag phase-1)
- RLS fail-closed per schoolId (ENABLE+FORCE, app_user tanpa BYPASSRLS, app_system BYPASSRLS hanya CLI/tes).
- Sesi opak `__Host-session` (prod) / `sms-session-dev` (next dev, otomatis via NODE_ENV) di Redis, TTL sliding 7 hari.
- Login Email/NISN per subdomain, argon2id, rate limit per IP + per akun, CSRF + Origin ketat, CSP nonce.
- Tes: shared 24, isolasi 9, auth 9, socket 2.

## Fase 2 — Master data (DONE, tag phase-2)
- Tabel baru (semua schoolId + RLS ENABLE+FORCE + policy tenant_isolation, grant di migrasi `phase2_rls`):
  - Subject (tenant penuh), SchoolSettings (tenant, app_user tanpa DELETE),
    TimetableSlot (tenant penuh), ImportBatch (tenant penuh; errorReport Json menyimpan
    rowErrors + kredensial sekali-unduh).
  - StudentProfile += gender, birthDate. TeacherClass/Class tetap (homeroomTeacherId).
  - Keputusan: SchoolSettings TIDAK publik (tenant) — portalName publik dibaca via School;
    password awal acak (mode nisn opsional di settings).
- Import Excel via BullMQ `import` (jobId `import-<batchId>`, idempotent rerun DONE, upsert by NISN,
  chunk 50 dalam runAsSchool timeout 120s, progress polling, laporan error .xlsx, kredensial .xlsx sekali-unduh lalu 410).
  Magic bytes ZIP (PK..) + batas 10MB; normalisasi No Ortu -> 62..., JK -> L/P, Tgl Lahir ISO/dd-mm-yyyy/serial Excel.
- API: /api/students(+import/progress/errors/credentials), /api/students/:id, /api/classes(+:id),
  /api/teachers(+:id/reset), /api/assignments, /api/subjects, /api/timetable(+PUT bulk),
  /api/settings (GET semua role, PATCH ADMIN), /api/profile(+avatar, file via /api/files/avatar/:name),
  semua via requireRole + CSRF + rate limit endpoint sensitif.
- UI (b.Indonesia): admin siswa/import/kelas/guru/penugasan/jadwal/pengaturan; guru kelas-saya; siswa profil.
- Tes (68 total hijau): shared 36 (+12 master: phone/gender/date/row), isolasi 13 (+4 tabel baru),
  web 14 (auth 9 + master 5: role-guard, scope guru, magic bytes), worker 5 (socket 2 + import 3).
- `pnpm test` mencakup semua file tes (server/__tests__/ + worker src/).
- Bug diperbaiki: zod .omit di schema refine (timetableSlotInputSchema), Prisma Json array (JSON round-trip),
  proxy cookie dev (terima sms-session-dev + __Host-session), allowedDevOrigins *.localtest.me.
- Tertunda: logo upload (settings.logoUrl), edit siswa inline (baru aktif/nonaktif), template .xlsx contoh.

## Fase 3 — Absensi (backend DONE, tag phase-3; UI fungsional mentah, styling menyusul semua fase)
- Tabel baru (schoolId + RLS ENABLE+FORCE + grant penuh, migrasi `phase3_rls`):
  - AttendanceRecord: unique (schoolId,studentId,date); status HADIR/IZIN/SAKIT/ALPHA;
    source SCAN/MANUAL/AUTO; scannedAt, classId snapshot, editedBy, note.
  - AcademicCalendar: (date,kind,classId?) + 2 partial unique index (global vs per-kelas;
    Prisma @@unique dihapus karena NULL dianggap beda di Postgres).
  - StudentQr: token statis `sms1-<32hex>` unique global + version/expiresAt (siap rotasi Phase lanjut).
- Scan (`POST /api/attendance/scan`, GURU/ADMIN + rate limit 120/mnt): idempoten via
  `scanDecision` di shared (HADIR ada -> duplicate; cooldown 60 dtk; non-HADIR boleh timpa),
  guru hanya siswa kelasnya (TeacherClass + wali kelas). Web publish ke Redis `att:scan`,
  worker Socket.io (room `school:<id>`, handshake authorizeSocket + cek Origin) broadcast;
  browser guru `speechSynthesis` id-ID antre ("<Nama> sudah hadir").
- Scanner guru (`/guru/scanner`): getUserMedia + BarcodeDetector (fallback input manual),
  antrean offline localStorage (retry 10 dtk + saat online kembali).
- Manual (`POST /api/attendance/manual`, tercatat editedBy + audit ATT.MANUAL).
- Kalender (`/api/attendance/calendar` GET bulan + POST/DELETE ADMIN) — dihormati auto-alpha.
- QR: `GET /api/attendance/qr` (terbitkan otomatis) + `/qr/png` (gambar via lib qrcode);
  kartu siswa `/siswa/kartu`; cetak massal sekelas (admin, window.print).
- Auto-Alpha: worker tick 5 mnt -> per sekolah cek cutoffTime (SchoolSettings) -> tandai ALPHA
  yang tanpa record; lewati LIBUR global/kelas, tanpa jadwal & tanpa override EFEKTIF,
  izin APPROVED (hook siap, Phase 6 menyambung); `pickAutoAlpha` murni di shared, mudah diuji.
  Gagal satu sekolah tidak menghentikan yang lain.
- Rekap: `/api/attendance/daily` (per kelas+hari, guru dibatasi kelasnya) +
  `/api/attendance/monthly` (ekspor .xlsx ADMIN). Halaman: guru `/guru/kehadiran`
  (+edit manual), admin `/admin/kehadiran` (+ekspor+cetak), `/admin/kalender`.
- Tes (85 hijau): shared 47 (+11 attendance: scan/cooldown/alpha/libur/efektif),
  isolasi 16 (+3 tabel Phase 3), web 17 (+3 authz guru-hanya-kelasnya), worker 5.
- Dep baru: socket.io-client (web realtime), qrcode + @types/qrcode (render QR PNG).
- Tertunda: PDF ekspor (baru .xlsx), suara di iOS Safari (perlu gesture dulu).

## Fase 4 — LMS dasar (DONE, tag phase-4)
- Tabel: Task (class, subject?, author, judul, instruksi, tipe, deadline, publishAt, allowLate, isGroup),
  TaskMaterial (TEXT/FILE/IMAGE), Submission (unique taskId+studentId, teks/link/file, isLate, score, feedback, grader).
  Semua RLS+FORCE + isolasi.
- API: /api/tasks (GET beda guru/siswa + POST), /api/tasks/[id] (GET detail+progres/pending, PATCH, DELETE admin),
  /api/tasks/[id]/submit (upsert, tolak TUTUP), /materials (GET/POST), /submissions/[id]/grade,
  /api/task-files/[taskId]/[name] (otorisasi kepemilikan: siswa lain 403, tercatat audit).
  File: magic pdf/png/jpg/webp/zip/mp4, 10MB, di tasks/<taskId>/.
- Logika murni di shared/lms.ts: isVisibleToStudent, submitState (BELUM/SUDAH/TERLAMBAT/TUTUP), canSubmit, isLateSubmit.
- UI mentah: guru tugas + detail (nilai + pending), siswa tugas + detail (kirim/dropzone),
  dasbor guru (kelas/tugas/absensi hari ini), dasbor siswa (profil/progres/pending).
- Tes (95): shared 53 (+6 lms), isolasi 17 (+1), web 20 (+3 file-scope), worker 5.

## Fase 5 — Notifikasi & WA (DONE, tag phase-5)
- Tabel: Notification (per user, readAt), MessageOutbox (to/text/status/attempts/dedupeKey unique/scheduledAt).
- shared/notify.ts: MessageProvider interface, normalizePhone (->62), renderTemplate, DEFAULT_TEMPLATES.
- Worker: FakeProvider (tes), BaileysProvider (sesi per sekolah di WA_SESSIONS_ROOT, QR pairing, reconnect
  kecuali logout), wa-queue (BullMQ "wa", jobId wa-<id>, jeda 3-10 dtk, cap/mnt+harian dari settings,
  retry 5x backoff eksponensial, tanpa fallback). reminders.ts (alpha alert + H-1 deadline),
  worker /wa-status internal (INTERNAL_TOKEN, loopback saja).
- Web: /api/notifications (+read), /api/wa/outbox (GET admin/guru, POST admin), /api/wa/status
  (proxy server-side + notifikasi "sesi putus" 1x/24jam), /api/tasks/nudge (pengingat/terima kasih),
  Bell di layout dash, /admin/wa (QR pairing render + kuota + antrean).
- Dep: @whiskeysockets/baileys 7.0.0-rc14 (worker saja; web tidak impor).
- Tes (102): shared 55, isolasi 18, web 22, worker 7. Image web+worker rebuilt + healthcheck OK.
- Tertunda: pairing WA sungguhan (lihat docs/wa-manual.md).

## Fase 6 — Izin & privasi (DONE, tag phase-6)
- Tabel: LeaveRequest (unique schoolId+studentId+date, foto live-capture, status, reviewer),
  CaptureSession (token opak 32hex, terikat user, sekali pakai, TTL 5 mnt),
  ParentalConsent (flag + penanda admin), PrivacyPolicy (teks per sekolah). RLS+FORCE + isolasi.
- Alur: siswa minta token (syarat consent) -> kamera live getUserMedia (tanpa opsi galeri di UI)
  -> POST multipart (token + foto siswa wajib + foto ortu opsional, JPEG/PNG asli, 3MB).
  Server tolak: tanpa token, token milik user lain, reuse, kedaluwarsa. Foto disimpan di
  leave/<s|p>-<acak>.jpg; daftar tak pernah bocorkan nama file.
- Review: wali/pengajar kelasnya atau admin; APPROVED -> WA ortu (dedupe) + dikecualikan
  auto-alpha (hook Phase 3 tersambung). Foto: hanya siswa itu/wali/admin, tiap baca audit
  LEAVE.PHOTO_ACCESS. Retensi: cron harian hapus file + null-kan ref setelah photoRetentionDays (def 30).
- LAPORAN PRIVASI: data anak yang disimpan = foto izin (JPEG), nama/NISN/kelas, no ortu.
  Akses: siswa (miliknya), wali kelasnya, admin. Retensi foto 30 hari (configurable).
  Tanpa consent -> tak bisa mengajukan. Pencegahan kamera = dasar, bukan anti-spoofing.
- Tes (107): shared 55, isolasi 19, web 26, worker 7.

## Fase 7 — Asesmen (DONE, tag phase-7)
- Tabel: Assessment (kind DIAGNOSTIC/REGULAR, shuffleQ/shuffleOpt, deadline), Question (bank soal
  guru per mapel + kunci), AssessQuestion (snapshot per asesmen — bank boleh diedit tanpa merusak
  asesmen jalan), AssessAttempt (unique assessmentId+studentId, qOrder+optOrders tersimpan),
  AssessAnswer (koordinat ASLI), StudyGroup/StudyGroupMember (unique assessmentId+studentId:
  satu siswa = satu grup), ExpLog (poin + dedupeKey). RLS+FORCE + isolasi.
- Integritas kunci: correctIndex/correctOrder TAK PERNAH ke klien (dites via payload JSON +
  RLS). Acak MCQ/SORTING deterministik per attempt (mulberry32 seed school|assess|student);
  nilai server-side (MCQ exact, SORTING parsial proporsional). Analisis butir: difficulty +
  distraktor. Diagnostik: histogram 10 bucket + rata-rata.
- API: /api/questions (bank, tanpa kunci), /api/assessments (CRUD + snapshot),
  /api/assessments/[id]/attempt (GET mulai + POST kumpul+EXP), /analysis, /diagnostic, /groups,
  /api/assess-files/[qid]/[name] (otorisasi peran). Gambar soal JPEG/PNG 5MB.
- UI mentah: guru asesmen (buat + analisis + diagnostik), siswa asesmen (MCQ radio + SORTING ↑↓).
- Tes (116): shared 61 (+6 assess), isolasi 20 (+1), web 28 (+2 kunci), worker 7.

## Fase 8 — Portal (DONE, tag phase-8)
- Tabel: ExpBadge (unique studentId+name), Announcement (target ALL/GURU/SISWA/kelas:<id>),
  CollabThread (senderId selalu tersimpan, anonymous, recipients multi-guru, revealedAt/By),
  CollabMessage (lampiran). RLS+FORCE + isolasi. Settings += expRules JSON (aturan poin configurable).
- Portal publik per subdomain (tanpa login, via runAsSchool dari slug — tenant_isolation tetap):
  /api/portal/info (nama, lat/lng, CTA GTK/Murid, pengumuman ALL) + halaman portal (peta Leaflet
  client-only + OSM, katalog e-book via BookProvider/OpenLibrary + cache 10 mnt, CTA).
  Dep: leaflet + @types/leaflet.
- Kolaborasi: POST multipart (recipients = guru aktif, anonim hanya siswa, lampiran jpg/png/pdf/zip
  5MB), GET mask ("Anonim" untuk guru bila anonim), reply peserta, reveal ADMIN + audit COLLAB.REVEAL,
  file hanya peserta. UI: siswa/guru inbox + admin inbox (reveal).
- EXP: awardExp idempoten (dedupeKey) — submit tepat/terlambat (attempt), hadir harian (scan),
  aturan dari settings; leaderboard per kelas; /api/exp/me + badge.
- Tes (120): shared 64 (+3 portal: target/mask/expRules), isolasi 21 (+1), web 28, worker 7.

## Fase 9 — Akademik ekstra (DONE, tag phase-9)
- Gradebook: server/gradebook.ts (rata-rata tugas 0-100 + asesmen dinormalisasi 0-100, avg gabungan),
  /api/gradebook + /api/gradebook/export (.xlsx via xlsx). Scope guru-kelasnya.
- Audit viewer: /api/audit (ADMIN, cursor pagination take≤100, filter action) + halaman admin/audit.
- PWA: manifest.webmanifest + ikon 192/512 (PIL) + sw.js (cache shell login, API tak di-cache,
  bump versi per rilis) + SwRegister client + metadata manifest di layout root.
- UI mentah: guru rapor (tabel + ekspor), admin audit.
- Tes (122): shared 64, isolasi 21, web 30 (+2 gradebook: agregasi + tolak guru luar), worker 7.

## Fase 10 — Hardening & operasi (DONE, tag phase-10)
- SUPER_ADMIN login via admin.<apex>: POST /api/auth/admin-login (Host ketat + Origin + rate limit).
  Kredensial via RPC SECURITY DEFINER (super_admin_cred/active) — web app_user tetap tanpa
  SYSTEM_URL dan tanpa SELECT baris NULL. auth-gate cabang admin + requireRole overload
  (tenant school non-null tanpa ubah 100+ route; me/logout/require-page/change-password
  guard school-null). Role shared += SUPER_ADMIN.
- Migrasi: phase10_superadmin_rpc + phase10_superadmin_active (GRANT EXECUTE app_user/app_system).
- Health super-admin: /api/admin/health (sekolah, antrean import/wa, /wa-status-all worker,
  disk statfs, backup env) + worker /wa-status-all (x-internal-token).
- Beban: scripts/k6-scan.js + k6-submit.js (ramp 500 VU, p95<800ms, error<1%) + cek duplikat SQL.
- Docs: backup-restore.md (dump+rsync+retensi 7 hari+drill) + security-checklist.md (RLS/auth/upload/
  asesmen/privasi/operasi + tabel drill).
- Tes (125): shared 64, isolasi 21, web 33 (+3 RPC: cred/active/tenant-dikecualikan), worker 7.
- Fix pasca-tag: `readSession` menolak `schoolId:""` (falsy) → sesi super-admin selalu
  401 di /api/admin/health. Regresi ditambah (web 34). Proxy: aset PWA publik
  (manifest/sw/ikon 200 tanpa sesi) + host admin lolos 404 + halaman /admin-login & /pantau
  (hanya host admin; proteksi data di API). Healthcheck image: worker ok, login 200,
  PWA 200, dash tanpa sesi 307, halaman admin di tenant 404, health tanpa sesi 401,
  admin-login→health bersesi 200 (cookie Secure; curl HTTP perlu kirim manual).
- LAPORAN AKHIR: 10 fase backend selesai (tag phase-1..10), 125 tes hijau, tsc+build bersih,
  image web+worker rebuilt + healthcheck OK. UI/styling menyusul (tunda per user).

## UI edukids (DONE — gaya dari referensi ~/Downloads/edukids.zip, isi ikut data asli)
- Fondasi: token cream/terracotta/olive/sun/sky/mint di globals.css, font Plus Jakarta Sans +
  DM Mono self-host (/fonts, tanpa CDN), aset karakter/doodle dikompres (alpha aman),
  tombol stiker + kartu editorial + motion hidup (float/breathe/drift + reveal aman-JS-lambat
  + reduced-motion). Proxy: /assets|fonts|manifest|sw|ikon bebas auth (matcher).
- Shell: DashShell (sidebar per peran + drawer HP + topbar Bell/avatar/logout + kartu sekolah),
  Logo SVG (teks di HTML), Reveal (visible-dulu pola aman).
- Landing publik `/`: guest 200 (hero editorial + pengumuman ALL asli + rak buku + peta/CTA),
  user login 307 ke dasbor perannya. Nav mati (#tentang) dibuang; hero dipadatkan agar CTA
  di atas fold.
- Dasbor siswa (data API asli): hero sapaan + maskot, 4 metrik (selesai/menunggu/EXP/lencana),
  tugas menunggu + lencana. Dasbor guru: hero hijau + antrean (izin pending/absen/tugas) +
  jalan pintas. Dasbor admin: hero gelap + denyut (siswa/guru/kelas/izin) + operasional.
  Login: split kartu + panel hijau maskot + doodle orbit/bintang.
- Verifikasi visual via screenshot: login OK, siswa OK (data asli: 2 tugas, 55 EXP),
  guru OK, admin OK, landing OK. Fix: headline tracking (-0.03em), page guru versi lama,
  sidebar overflow, Reveal pudar, sapaan "Bu Sinta", metrik students pakai rows.
- Tes 126 hijau, tsc 0, build 44/44.

## UI publik lanjutan (DONE, commit menyusul — landing ala edukids + rak ebook)
- Root `/` publik untuk guest maupun login: tanpa redirect paksa; CTA adaptif
  (AuthCta: guest "Masuk", login "Buka dasbor" sesuai ROLE_HOME + SUPER_ADMIN).
  Proxy: `/buku` publik; CSP img + remotePatterns covers.openlibrary.org (sampul).
- Ebook ala contoh: section landing = 4 kartu populer (PopularBooks, data
  /api/portal/popular-books: 1 buku per subjek Cerita/Sains/Aktivitas/Dunia,
  cache 6 jam) + tombol "Buka rak ebook". Halaman `/buku` publik per sekolah:
  populer + cari (search-books publik, rate limit 30/mnt/IP + cache 10 mnt),
  kartu bersampul menaut ke Open Library, CTA adaptif login/dasbor.
  Verifikasi: /buku 200, popular 4 buku asli + cover, search 200,
  root login 200 (tanpa redirect), template tanpa sesi 401.
- Tertunda yg dibereskan: template .xlsx impor siswa
  (/api/students/import/template ADMIN, header = worker, + tombol unduh di
  /admin/siswa) + edit inline siswa (dialog nama/kelas/no ortu, PATCH yg sudah
  ada). Aktif/nonaktif sudah ada sebelumnya.
- Sisa tertunda (bukan prioritas user, tetap tercatat): logo upload
  (settings.logoUrl), PDF ekspor (baru .xlsx), suara iOS Safari (perlu gesture),
  pairing WA sungguhan (docs/wa-manual.md).
- Finalisasi: /buku pakai AuthCta (hapus CTA hardcode /siswa yg salah utk
  guru/admin), /api/auth/me dibaca {user.role} (bukan {role}), BookSearch lama
  dihapus (diganti PopularBooks + /buku). next-env.d.ts/tsbuildinfo di-revert.
- Verifikasi akhir: 126 tes hijau (shared 64, isolasi 21, web 34, worker 7),
  tsc 0, build 47/47. Screenshot /buku: 4 kartu bersampul asli (Cerita/Sains/
  Aktivitas/Dunia) + cari OK.

## UI dasbor: 35 halaman peran gaya edukids (DONE, commit 6f4b1f2)
- Primitif baru `components/DashUI.tsx`: PageHead, SegStat, Panel, WarmTable,
  TextInput/TextSelect, Btn/LinkBtn, Badge, Toolbar, Note/Err. `components/ui.tsx`
  diselaraskan (Button/Input/Select/Table/Pager di atas DashUI, API sama).
- 35 halaman dipoles: siswa 8 (tugas+[id], asesmen, izin, kartu, leaderboard,
  profil, inbox via CollabInbox), guru 9 (kelas-saya, tugas+[id], asesmen,
  kehadiran, scanner, izin, rapor, inbox), admin 15 (siswa, kelas, guru,
  penugasan, jadwal, kalender, kehadiran, pengaturan, pengumuman, privasi, wa,
  import, audit, inbox) + change-password, admin-login, pantau.
- Nol `<main>`/`<h1>` mentah tersisa di (dash). Verifikasi: tsc 0, test penuh
  20 file/126 hijau, build 47/47 sukses, markup gaya baru terkonfirmasi di
  render 3 peran (siswa/tugas, guru/kehadiran, admin/siswa).
