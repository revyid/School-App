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
