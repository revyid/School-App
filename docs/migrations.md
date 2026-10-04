# Migrasi

Env:
- `MIGRATE_URL` = owner `sms` (superuser, = POSTGRES_USER). Dipakai
  `prisma.config.ts` untuk `migrate`/`generate`.
- `DATABASE_URL` = role `app_user` (runtime tenant + tes isolasi).
- `SYSTEM_URL` = role `app_system` (hanya tes lintas-sekolah + `@sms/cli`).

## Dev (DB lokal, boleh reset)
export MIGRATE_URL="postgresql://sms:***@127.0.0.1:5432/smsdb"
pnpm --filter @sms/db exec prisma migrate dev
# Bila checksum 0002 berubah setelah di-apply:
pnpm --filter @sms/db exec prisma migrate reset
# reset menghapus SEMUA data dev lalu apply ulang. JANGAN di prod.

## Prod/server (tidak pernah reset)
pnpm --filter @sms/db exec prisma migrate deploy
