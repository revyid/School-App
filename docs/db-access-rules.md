# Aturan akses DB

- `apps/web` dan `apps/worker` HANYA memakai role `app_user` (DATABASE_URL)
  + `runAsSchool()`. Tidak ada koneksi istimewa di kedua service.
- Koneksi istimewa (`app_system`, BYPASSRLS) hanya ada di
  `packages/cli/src/system.ts` (dipakai `@sms/cli`) dan
  `packages/db/src/test-utils.ts` (TEST-ONLY, hanya diimpor `*.test.ts` —
  ditegakkan `pnpm lint`).
- Tidak ada login SUPER_ADMIN via web; tidak ada `admin.<apex>`.
- Cron worker lintas sekolah: iterasi School (SELECT publik), lalu satu
  transaksi per sekolah:

```ts
const schools = await db.school.findMany({ select: { id: true } });
for (const s of schools) {
  await runAsSchool(db, s.id, (tx) => doPerSchool(tx), { timeout: 60_000, maxWait: 10_000 });
}
```
