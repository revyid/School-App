# Security review checklist (Phase 10) — jalankan tiap rilis

## RLS / tenants
- [ ] `pnpm test` hijau: `tenant-isolation.test.ts` mencakup SEMUA tabel di RLS_TABLES
      (saat ini 34 tabel) + blok `it` per tabel baru.
- [ ] Semua tabel tenant: ENABLE + FORCE RLS + policy `tenant_isolation`
      (pola migrasi `*_rls`), grant minimal ke `app_user`.
- [ ] `AuditLog` append-only (app_user tanpa UPDATE/DELETE).
- [ ] `School` SELECT publik hanya kolom direktori; `User.schoolId NULL`
      tak terbaca app_user kecuali via RPC definer (`super_admin_*`).

## Auth / sesi
- [ ] Cookie host-only (tanpa Domain) + HttpOnly + Secure (prod) + SameSite Lax.
- [ ] schoolId sesi == subdomain; mismatch → 401. `admin.<apex>` hanya SUPER_ADMIN.
- [ ] Rate limit login per IP + per akun; 429 + Retry-After.
- [ ] CSRF + Origin di semua mutasi; mustChangePassword gate.
- [ ] argon2id; pesan login seragam (tanpa enumerasi user).

## Upload
- [ ] Magic bytes (bukan ekstensi) + batas ukuran + nama acak + scope
      `/data/uploads/<schoolId>/` + serve via route otorisasi + nosniff.
- [ ] Avatar 2MB, tugas 10MB, izin 3MB, soal 5MB, kolaborasi 5MB.

## Asesmen
- [ ] Kunci (`correctIndex/correctOrder`) tak pernah ke klien — verifikasi:
      `pnpm test` (`assess.test.ts` payload tanpa kunci) + cek manual DevTools.
- [ ] Acak + nilai server-side; attempt idempoten 1 per (assessment, student).

## Privasi (PDP anak)
- [ ] Foto izin: akses siswa-itu/wali/admin + audit `LEAVE.PHOTO_ACCESS` tiap baca.
- [ ] Retensi foto jalan (cron harian, `photoRetentionDays` default 30).
- [ ] Consent flag: tanpa consent tak bisa ajukan izin.
- [ ] Kolaborasi anonim: senderId selalu tersimpan; reveal hanya ADMIN + audit.
- [ ] Laporan privasi Phase 6 masih akurat (docs/PROGRESS.md).

## Operasi
- [ ] Health super-admin hijau: antrean gagal = 0, WA terhubung, backup < 26 jam.
- [ ] k6 scan+submit: p95 < 800ms, error < 1%, tanpa duplikat.
- [ ] Restore drill terakhir < 90 hari (catat tanggal di bawah).

| Tanggal | Drill | Hasil |
| ------- | ----- | ----- |
| -       | -     | -     |
