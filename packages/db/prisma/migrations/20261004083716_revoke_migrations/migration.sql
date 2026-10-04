-- Cabut hak role runtime dari tabel internal migrasi (owner `sms` tetap bisa).
-- Dibungkus DO + cek pg_class agar idempotent di semua search_path / runner.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations') THEN
    EXECUTE 'REVOKE ALL ON public."_prisma_migrations" FROM app_user, app_system';
  END IF;
END $$;
