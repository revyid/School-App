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
