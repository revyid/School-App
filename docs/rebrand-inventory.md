# Inventaris Rebranding: "sms-lms"/"SMS-LMS" → "lacakedu"

Dibuat: 2026-10-22 · Status repo: rebrand **sebagian sudah jalan** (root `package.json` = `lacakedu`, semua quadlet deploy = `lacakedu-*`, domain default `lacakedu.web.id`, `Logo.tsx`/`PublicLogo.tsx`/`SchoolLogo.tsx` default teks `lacakedu`, baileys browser tag = `lacakedu`). Sisa-sisa di bawah adalah yang belum tersentuh.

Cakupan pencarian: file text git-tracked; **dikecualikan** `node_modules`, `.next/`, `dist/`, `docs/PROGRESS.md`, `.hermes/plans/`, `pnpm-lock.yaml` (kecuali disebut), biner (`*.png/webp/jpg`, `vendor/piper`), dan `data/wa-sessions/*.json` (base64 kebetulan mengandung substring "sms").

Total sisa: **±602 baris cocok di 223 file** (sebelum dikurangi file noise .hermes/PROGRESS).

---

## 1. Tabel ringkas per kategori

| Kategori | Kemunculan (≈) | File terdampak (≈) | Inti pekerjaan |
|---|---|---|---|
| **[BRAND]** scope & nama paket `@sms/*` | 492 | 184 (182 in-scope) | Ganti ke `@lacakedu/*` + nama paket + `bin` + Containerfile |
| **[BRAND]** teks UI & judul "SMS-LMS"/"sms" | 22 | 17 | String literal di tsx/ts/webmanifest/css |
| **[BRAND]** path folder lokal `…/sms-lms/…` | 8 | 6 | Hanya jika folder repo ikut di-rename |
| **[BRAND]** data DB `platformName='SMS-LMS'` | 1 (+ live DB) | 1 migration + baris data di Postgres | UPDATE data, jangan edit migration lama |
| **[TEKNIK]** env `SMS_COOKIE_*` | 9 | 3 | auth.ts + 2 script dev |
| **[TEKNIK]** nama cookie dev `sms-session-dev*` | 15 | 8 | auth.ts + proxy.ts + 4 script dev |
| **[TEKNIK]** role PG `sms` / db `smsdb` / backup `/var/backups/sms` | ±40 | 12 | Butuh aksi di server (env, pg_dump, systemd) |
| **[TEKNIK]** prefix token QR `sms1-` | 15 | 8 | Kompatibilitas data QR lama di DB |
| **[TEKNIK]** cache/istilah internal (`sms-shell-v2`, `sms-notif`, `sms-tts`, `sms-pgdata`, `sms-test-*`) | 8 | 4 | Dev/aset lokal |
| **[BIASA]** SMS = Short Message Service / kebetulan | 1 baris kode + 11 file biner | 12 | **JANGAN diganti** |

### Contoh paling penting per kategori

**[BRAND] — teks UI (yang paling terlihat user):**

| FILE:LINE | Potongan |
|---|---|
| `apps/web/app/beranda/page.tsx:55,173,197` | `<span …>SMS-LMS</span>`, `SMS-LMS © {year}` |
| `apps/web/components/Logo.tsx:40` | `sms<span className="text-terracotta">-lms</span>` ← wordmark fallback (default saat nama sekolah kosong) |
| `apps/web/app/layout.tsx:12` | `title: "SMS-LMS"` (metadata/SEO) |
| `apps/web/public/manifest.webmanifest:2-5` | `"name": "SMS-LMS"`, `"short_name": "SMS"`, `"description": "Sistem Manajemen Sekolah + LMS"` |
| `apps/web/app/(portal)/PortalHome.tsx:320` | `<span>SMS-LMS</span>` |
| `apps/web/app/(dash)/pantau/layout.tsx:48` | `SMS-LMS · Pantau` |
| `apps/web/app/perkakas/peta/page.tsx:9` & `timeline/page.tsx:9` | `title: "… — Tools SMS-LMS"` |
| `apps/web/components/admin/SiswaManager.tsx:129` | `ctx.fillText("SMS-LMS • PRESENSI & PORTAL SISWA DIGITAL", …)` ← tercetak di kartu QR siswa |
| `packages/db/prisma/migrations/20261020150000_…/migration.sql:37` | `('platformName', to_jsonb('SMS-LMS'::text))` ← seed yang juga sudah hidup di tabel `root settings` |

**[BRAND] — scope/nama paket:**

| FILE:LINE | Potongan |
|---|---|
| `package.json:18,19,21` | `pnpm --filter @sms/…`, `--filter '@sms/*'` |
| `packages/db/package.json:2` | `"name": "@sms/db"` |
| `packages/cli/package.json:6` | `"bin": { "sms-admin": "./dist/index.js" }` |
| `apps/web/app/api/students/route.ts:7-8` | `import { db } from "@sms/db/client"` (contoh dari 452 baris import) |
| `deploy/images/Containerfile.web:7-12` | `pnpm --filter @sms/db …` |
| `scripts/lint-imports.sh:7-8` | `git grep -l -- '@sms/db/test-utils' …` |

**[TEKNIK]:**

| FILE:LINE | Potongan |
|---|---|
| `packages/shared/src/auth.ts:9-13` | `process.env.SMS_COOKIE_NAME ?? …` / `SMS_COOKIE_SECURE` |
| `packages/shared/src/auth.ts:10` | cookie dev `"sms-session-dev"` |
| `deploy/quadlet/postgres.env.example:2,4` | `POSTGRES_USER=sms`, `POSTGRES_DB=smsdb` |
| `scripts/db-create-roles.sql:29,31,33` | `ALTER DEFAULT PRIVILEGES FOR ROLE sms …` |
| `apps/web/app/api/attendance/qr/route.ts:11` | `` return `sms1-${randomBytes(16).toString("hex")}` `` |
| `apps/web/public/sw.js:6,50` | `const CACHE = "sms-shell-v2"`, `tag: "sms-notif"` |
| `apps/web/server/tts.ts:29` | `… os.homedir(), ".cache", "sms-tts"` |

**[BIASA] — JANGAN diganti:**

| FILE:LINE | Potongan | Alasan |
|---|---|---|
| `docs/wa-manual.md:28` | `Tidak ada SMS/email cadangan.` | "SMS" = Short Message Service (konteks WhatsApp) |

---

## 2. Daftar file per kategori (lengkap, untuk diproses per batch)

### 2a. [BRAND] Teks UI / judul / branding visible (17 file)

```
apps/web/app/(dash)/pantau/layout.tsx
apps/web/app/(portal)/PortalHome.tsx
apps/web/app/api/portal/search-books/route.ts        ← User-Agent "SMS-LMS/1.0"
apps/web/app/beranda/page.tsx
apps/web/app/globals.css                             ← komentar saja
apps/web/app/layout.tsx
apps/web/app/perkakas/peta/page.tsx
apps/web/app/perkakas/timeline/page.tsx
apps/web/components/Logo.tsx                         ← komentar:1 + wordmark:40
apps/web/components/admin/SiswaManager.tsx
apps/web/public/manifest.webmanifest
apps/web/public/sw.js                                ← nama cache (lihat 2d)
apps/web/server/ai-site-guide.ts                     ← komentar:1 (dibaca AI chat)
apps/web/server/tts.ts                               ← path cache (lihat 2d)
packages/db/prisma/migrations/20261020150000_root_role_root_settings/migration.sql  ← SEBAGAI DOKUMEN; jangan edit, tambah UPDATE data live
```

### 2b. [BRAND] Scope paket `@sms/*` + nama paket (182 file in-scope)

Pemilik nama (6 file):

```
package.json                                    ← 3 script filter '@sms/*'
packages/shared/package.json                    ← name @sms/shared
packages/db/package.json                        ← name @sms/db
packages/cli/package.json                       ← name @sms/cli + bin "sms-admin"
apps/web/package.json                           ← name @sms/web + 2 dep
apps/worker/package.json                        ← name @sms/worker + 2 dep
```

Konsumen import (170 file .ts/.tsx):

<details><summary>Klik untuk daftar 170 file</summary>

```
apps/web/app/(dash)/admin/layout.tsx
apps/web/app/(dash)/admin/page.tsx
apps/web/app/(dash)/guru/tugas/[id]/page.tsx
apps/web/app/(dash)/guru/tugas/new/page.tsx
apps/web/app/(dash)/guru/tugas/page.tsx
apps/web/app/(dash)/layout.tsx
apps/web/app/(dash)/pantau/layout.tsx
apps/web/app/(dash)/siswa/kelasku/tugas/[id]/page.tsx
apps/web/app/(portal)/AuthCta.tsx
apps/web/app/(portal)/page.tsx
apps/web/app/anonim/page.tsx
apps/web/app/api/admin/health/route.ts
apps/web/app/api/ai/chat/route.ts
apps/web/app/api/announcements/route.ts
apps/web/app/api/anonim/route.ts
apps/web/app/api/assess-files/[qid]/[name]/route.ts
apps/web/app/api/assessments/[id]/analysis/route.ts
apps/web/app/api/assessments/[id]/attempt/route.ts
apps/web/app/api/assessments/[id]/attempts/route.ts
apps/web/app/api/assessments/[id]/diagnostic/route.ts
apps/web/app/api/assessments/[id]/result/route.ts
apps/web/app/api/assessments/[id]/route.ts
apps/web/app/api/assessments/route.ts
apps/web/app/api/assignments/route.ts
apps/web/app/api/attendance/calendar/batch/route.ts
apps/web/app/api/attendance/calendar/route.ts
apps/web/app/api/attendance/daily/route.ts
apps/web/app/api/attendance/manual/route.ts
apps/web/app/api/attendance/monthly/route.ts
apps/web/app/api/attendance/qr/png/route.ts
apps/web/app/api/attendance/qr/route.ts
apps/web/app/api/attendance/scan/route.ts
apps/web/app/api/audit/route.ts
apps/web/app/api/auth/change-password/route.ts
apps/web/app/api/auth/consent/route.ts
apps/web/app/api/auth/login/route.ts
apps/web/app/api/auth/logout/route.ts
apps/web/app/api/auth/me/route.ts
apps/web/app/api/classes/[id]/route.ts
apps/web/app/api/classes/route.ts
apps/web/app/api/collab/[id]/file/route.ts
apps/web/app/api/collab/[id]/reply/route.ts
apps/web/app/api/collab/[id]/reveal/route.ts
apps/web/app/api/collab/route.ts
apps/web/app/api/consent/route.ts
apps/web/app/api/exp/leaderboard/route.ts
apps/web/app/api/exp/me/route.ts
apps/web/app/api/files/avatar/[name]/route.ts
apps/web/app/api/gurus/route.ts
apps/web/app/api/leave/[id]/photo/route.ts
apps/web/app/api/leave/[id]/route.ts
apps/web/app/api/leave/capture/route.ts
apps/web/app/api/leave/route.ts
apps/web/app/api/notifications/broadcast/route.ts
apps/web/app/api/notifications/read/route.ts
apps/web/app/api/notifications/route.ts
apps/web/app/api/policy/route.ts
apps/web/app/api/portal/info/route.ts
apps/web/app/api/portal/logo/route.ts
apps/web/app/api/portal/popular-books/route.ts
apps/web/app/api/portal/search-books/route.ts
apps/web/app/api/profile/avatar/route.ts
apps/web/app/api/profile/route.ts
apps/web/app/api/push/broadcast/route.ts
apps/web/app/api/push/subscribe/route.ts
apps/web/app/api/push/test/route.ts
apps/web/app/api/questions/route.ts
apps/web/app/api/root/analytics/route.ts
apps/web/app/api/root/audit/route.ts
apps/web/app/api/root/files/route.ts
apps/web/app/api/root/schools/route.ts
apps/web/app/api/root/settings/hero/route.ts
apps/web/app/api/root/settings/route.ts
apps/web/app/api/root/users/[id]/active/route.ts
apps/web/app/api/root/users/route.ts
apps/web/app/api/settings/logo/route.ts
apps/web/app/api/settings/route.ts
apps/web/app/api/students/[id]/reset-password/route.ts
apps/web/app/api/students/[id]/route.ts
apps/web/app/api/students/import/[batchId]/credentials/route.ts
apps/web/app/api/students/import/[batchId]/errors/route.ts
apps/web/app/api/students/import/[batchId]/route.ts
apps/web/app/api/students/import/route.ts
apps/web/app/api/students/import/template/route.ts
apps/web/app/api/students/qr-cards/route.ts
apps/web/app/api/students/route.ts
apps/web/app/api/students/single/route.ts
apps/web/app/api/subjects/route.ts
apps/web/app/api/task-files/[taskId]/[name]/route.ts
apps/web/app/api/tasks/[id]/categories/[cid]/route.ts
apps/web/app/api/tasks/[id]/categories/route.ts
apps/web/app/api/tasks/[id]/grades/route.ts
apps/web/app/api/tasks/[id]/groups/[gid]/leave/route.ts
apps/web/app/api/tasks/[id]/groups/[gid]/members/route.ts
apps/web/app/api/tasks/[id]/groups/[gid]/route.ts
apps/web/app/api/tasks/[id]/groups/route.ts
apps/web/app/api/tasks/[id]/materials/[mid]/route.ts
apps/web/app/api/tasks/[id]/materials/route.ts
apps/web/app/api/tasks/[id]/nudge/route.ts
apps/web/app/api/tasks/[id]/roster/route.ts
apps/web/app/api/tasks/[id]/route.ts
apps/web/app/api/tasks/[id]/submit/route.ts
apps/web/app/api/tasks/route.ts
apps/web/app/api/teachers/[id]/route.ts
apps/web/app/api/teachers/route.ts
apps/web/app/api/timetable/export/route.ts
apps/web/app/api/timetable/import/route.ts
apps/web/app/api/timetable/route.ts
apps/web/app/api/timetable/subjects/route.ts
apps/web/app/api/timetable/template/route.ts
apps/web/app/api/tts/route.ts
apps/web/app/api/wa/broadcast/route.ts
apps/web/app/api/wa/outbox/route.ts
apps/web/app/api/wa/ready/route.ts
apps/web/app/api/wa/status/route.ts
apps/web/app/buku/page.tsx
apps/web/app/lib/require-page.ts
apps/web/app/login/page.tsx
apps/web/app/perkakas/page.tsx
apps/web/app/perkakas/peta/page.tsx
apps/web/app/perkakas/timeline/page.tsx
apps/web/app/privasi/page.tsx
apps/web/app/syarat/page.tsx
apps/web/components/CategorySheet.tsx
apps/web/lib/public-cache.ts
apps/web/proxy.ts
apps/web/server/__tests__/assess.test.ts
apps/web/server/__tests__/attendance-authz.test.ts
apps/web/server/__tests__/attendance-izin.test.ts
apps/web/server/__tests__/auth-security.test.ts
apps/web/server/__tests__/gradebook.test.ts
apps/web/server/__tests__/leave.test.ts
apps/web/server/__tests__/lms-scope.test.ts
apps/web/server/__tests__/master-data.test.ts
apps/web/server/__tests__/notify.test.ts
apps/web/server/__tests__/super-admin.test.ts
apps/web/server/__tests__/timetable-siswa.test.ts
apps/web/server/api-gate.ts
apps/web/server/audit.ts
apps/web/server/auth-gate.ts
apps/web/server/change-password.ts
apps/web/server/exp.ts
apps/web/server/gradebook.ts
apps/web/server/leave-photos.ts
apps/web/server/lms-scope.ts
apps/web/server/login.ts
apps/web/server/notify.ts
apps/web/server/outbox.ts
apps/web/server/password.ts
apps/web/server/push.ts
apps/web/server/queue.ts
apps/web/server/session.ts
apps/web/server/super-login.ts
apps/web/server/task-helpers.ts
apps/web/server/timetable-subjects.ts
apps/worker/src/auto-alpha.ts
apps/worker/src/baileys-provider.ts
apps/worker/src/fake-provider.ts
apps/worker/src/import-processor.test.ts
apps/worker/src/import-processor.ts
apps/worker/src/index.ts
apps/worker/src/realtime.ts
apps/worker/src/reminders.ts
apps/worker/src/retention.ts
apps/worker/src/socket-auth.test.ts
apps/worker/src/socket-auth.ts
apps/worker/src/wa-queue.ts
packages/cli/src/index.ts
packages/cli/src/system.ts
packages/db/src/test-utils.ts
```

</details>

Di luar kode (wajib sinkron, 12 file):

```
deploy/images/Containerfile.web
deploy/images/Containerfile.worker
docs/db-access-rules.md
docs/migrations.md
scripts/db-create-roles.sql
scripts/lint-imports.sh
pnpm-lock.yaml                          ← regenerated oleh pnpm install
```

### 2c. [BRAND] Path folder lokal `/home/revy/Projects/me/sms-lms` (6 file)

```
scripts/deploy.sh:8
scripts/dev/run-web-boot.sh:5,10
scripts/dev/run-web-dev.sh:5,9
apps/web/server/uploads.ts:4            ← fallback UPLOADS_ROOT
apps/worker/src/import-processor.test.ts:9  ← fallback UPLOADS_ROOT
```

> Catatan: nama folder repo di disk (`sms-lms`) dan direktori `~/lacakedu` yang dipakai quadlet sudah berbeda — path ini hanya fallback/explicit dev path. Ubah **bersamaan** dengan rename folder, jangan sendirian.

### 2d. [TEKNIK] File per kelompok teknis

**Env & cookie (3 file):**

```
packages/shared/src/auth.ts
scripts/dev/run-web-boot.sh
scripts/dev/run-web-dev.sh
```

+ 4 file pemakai nama cookie dev `sms-session-dev`: `apps/web/proxy.ts`, `scripts/dev/auth-test.sh`, `scripts/dev/e2e-assessment.sh`, (run-web-* sudah di atas).

**Role PG / nama db / backup (12 file):**

```
apps/web/.env.example
apps/worker/.env.example
deploy/quadlet/lacakedu-postgres.container
deploy/quadlet/postgres.env.example
docs/backup-restore.md
docs/dev.md
docs/migrations.md
packages/db/prisma.config.ts
packages/db/prisma/migrations/20261004083602_rls/migration.sql              (komentari saja)
packages/db/prisma/migrations/20261004083716_revoke_migrations/migration.sql (komentari saja)
packages/db/prisma/migrations/20261020150000_root_role_root_settings/migration.sql
packages/db/prisma/migrations/20261022120000_book_contentview_school_branding/migration.sql
scripts/db-create-roles.sql
```

**Prefix token QR `sms1-` (8 file):**

```
apps/web/app/api/attendance/qr/route.ts:11
apps/web/app/api/students/route.ts:132
apps/web/app/api/students/qr-cards/route.ts:61
apps/web/app/api/students/import/route.ts:163
apps/web/app/api/students/single/route.ts:80
apps/web/app/(dash)/guru/scanner/page.tsx:217,266,358
packages/db/src/tests/tenant-isolation.test.ts:44,210
scripts/k6-scan.js:33
```

**Istilah internal kecil (2 file):**

```
apps/web/public/sw.js:6 ("sms-shell-v2"), :50 ("sms-notif")
apps/web/server/tts.ts:29 ("sms-tts" cache dir)
```

**Nama container/volume dev (2 file):**

```
scripts/dev/reset-db.sh            (sms-pgdata, sms-redisdata, sms-test-pg, sms-test-redis)
docs/dev.md:13-15
```

---

## 3. Daftar "JANGAN DIGANTI" ([BIASA])

| Lokasi | Teks | Alasan |
|---|---|---|
| `docs/wa-manual.md:28` | "Tidak ada **SMS**/email cadangan." | SMS = Short Message Service (kanal pesan), konteks WhatsApp. |
| `data/wa-sessions/**/*.json` (11 file) | substring "sms" di dalam base64 | Kebetulan enkoding, bukan teks. Jangan disentuh — file sesi WA. |
| `apps/web/vendor/piper/*`, `apps/web/public/assets/*.png/webp` | kecocokan biner | Noise biner. |
| `pnpm-lock.yaml` | hash integrity mengandung "sms" | Regenerasi otomatis saat batch scope; jangan edit manual. |

Yang **mirip brand tapi tetap dibiarkan dulu** (bukan [BIASA], tapi keputusan sadar):

| Lokasi | Alasan |
|---|---|
| `apps/web/app/api/wa/*`, `apps/worker/src/wa-queue.ts`, `baileys-provider.ts` | Modul WhatsApp — namanya "wa", tidak ada "sms" di dalamnya selain import scope. Cukup kena batch scope. |
| `packages/shared/src/notify.ts` & template pesan WA | Tidak mengandung "sms" sama sekali — tidak perlu disentuh. |

Yang **terlihat seperti [BIASA] tapi sebenarnya BRAND** (awas salah kategori):

- `manifest.webmanifest:3` `"short_name": "SMS"` — di sini SMS = **Sistem Manajemen Sekolah** (lihat baris description), jadi ini merk, **ganti**.
- `packages/cli` bin `sms-admin` — bukan layanan pesan, ini nama tool, **ganti**.
- Prefix token `sms1-` — bukan Short Message Service, ini identifier internal QR, **boleh ganti** (hati-hati data, lihat batch 6).

---

## 4. Risiko & urutan ganti (rekomendasi)

| Batch | Isi | Tingkat | Catatan risiko |
|---|---|---|---|
| **1** | Teks UI: beranda, PortalHome, layout title, pantau, perkakas, SiswaManager, Logo.tsx:40, manifest, User-Agent, komentar globals.css & ai-site-guide | **Aman** | Murni string. `Logo.tsx:40` hanya render bila nama sekolah kosong — paling sering terlihat, prioritaskan. |
| **2** | Data DB: `UPDATE root_settings SET value='\"lacakedu\"' WHERE key='platformName'` (nilai yang kini berisi `SMS-LMS`) | **Aman-sedang** | Ini **data**, bukan migration. Migration `20261020150000` sudah ter-apply — **jangan diedit** (prisma checksum). Bisa lewat UI Root Settings atau SQL langsung. |
| **3** | Scope `@sms/*` → `@lacakedu/*` + nama paket + Containerfile + lint-imports.sh + root scripts | **Aman (mekanis, besar)** | 182 file, satu pola. Wajib `pnpm install` (lockfile churn) lalu `pnpm check` + `pnpm test` + rebuild image. |
| **4** | `bin` `sms-admin` → `lacakedu-admin` (+ usage di cli/src/index.ts) | **Aman** | Hanya kebiasaan shell + dokumen. |
| **5** | Env `SMS_COOKIE_*` → mis. `LAKAKEDU_COOKIE_*` + nama cookie dev `sms-session-dev*` → `lacakedu-dev*` | **Sedang** | Ubah **serentak** `auth.ts` + `proxy.ts:45` + 4 script dev. Prod pakai `__Host-session` (risiko prod rendah); efek samping: semua sesi dev logout. Env `SMS_COOKIE_*` **tidak ada** di `.env` live server (sudah dicek) — aman. |
| **6** | Role/db Postgres `sms`/`smsdb` + `/var/backups/sms` + nama file dump | **Berisiko (server-side)** | Butuh aksi di luar repo: `ALTER ROLE … RENAME`, `ALTER DATABASE smsdb RENAME`, update `postgres.env`/`worker.env` server, cek `MIGRATE_URL`/`DATABASE_URL` yang sudah terpasang, jalur cron backup. Jangan ubah migration SQL lama. Disarankan: role lama dibiarkan + role baru dibuat bertahap. |
| **7** | Prefix QR `sms1-` → mis. `laka1-` | **Berisiko (data)** | Token lama di tabel `studentQr`/absensi memakai `sms1-`. Scanner (`scanner/page.tsx:266`) wajib **menerima dua prefix** dulu (`/^(sms1|laka1)-/`), baru generator dipindah. Regresi langsung: QR kartu siswa & absensi yang sudah tercetak. |
| **8** | Nama container/volume dev `sms-test-*`, `sms-pgdata`, `sms-redisdata` | **Aman (dev-only)** | Berisi data test; volume lama bisa dibiarkan terbengkalai. |
| **9** | Path absolut `/home/revy/Projects/me/sms-lms` di scripts & 2 fallback kode | **Aman** | Hanya ikut berubah bila folder repo di-rename. Ubah bersamaan, jangan terpisah. |

Urutan aman: **1 → 3 → 4 → 8** (semua lokal, terverifikasi `pnpm test`), lalu **5 → 9**, terakhir **2 → 6 → 7** (menyentuh data & server).

---

## 5. Perkiraan skala per batch

| Batch | File | Baris (≈) | Estimasi kerja |
|---|---|---|---|
| 1 — Teks UI | 13 | 22 | 30 menit |
| 2 — Data platformName | 1 (+DB) | 1 | 5 menit + cek UI root |
| 3 — Scope @sms/* | 184 | ±500 + lockfile | 1–2 jam (sed + verifikasi) |
| 4 — bin sms-admin | 2 | 4 | 5 menit |
| 5 — Env & cookie | 7 | ±20 | 30 menit |
| 6 — Role/db/backup | 12 | ±40 + operasi server | 1–2 jam + koordinasi server |
| 7 — Prefix QR | 8 | 15 | 30 menit + QA scan |
| 8 — Container dev | 2 | 15 | 10 menit |
| 9 — Path lokal | 6 | 8 | 5 menit (bersama rename folder) |

---

## Lampiran: temuan tambahan

- Tidak ada nama file di repo (git-tracked) yang mengandung "sms" selain `.hermes/plans/*-sms-lms-ux-*.md` (dikecualikan dari cakupan).
- `packages/db/prisma/schema.prisma`: **0** kemunculan "sms" — tidak ada tabel/kolom ber-`sms`, jadi tidak ada migrasi skema DB untuk rebrand (kecuali prefix token di kolom `token`).
- Hostname "sms-server" **tidak ada** di repo; infra deploy sudah memakai `lacakedu-*`.
- `.env` live (`apps/web/.env`, `apps/worker/.env`) **tidak** memuat variabel `SMS_*` — hanya nama db `smsdb` di URL (bagian batch 6).
- `apps/web/.next/standalone/**` berisi salinan kode lama dengan "sms" — artefak build, bukan sumber; jangan dimasukkan hitungan.
