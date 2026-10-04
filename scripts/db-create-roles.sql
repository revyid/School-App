-- Dijalankan SEKALI sebagai superuser POSTGRES_USER (`sms`), SEBELUM migrasi:
--   podman exec -i sms-lms-postgres psql -U sms -d smsdb < scripts/db-create-roles.sql
-- Tiga peran koneksi, JANGAN dicampur:
--   sms        : superuser (dibuat image postgres dari POSTGRES_USER). DDL + migrate.
--                Superuser MELEWATI semua RLS termasuk FORCE — migrasi tidak buta.
--                Password-nya TIDAK PERNAH masuk ke env aplikasi.
--   app_system : LOGIN + BYPASSRLS. HANYA untuk test lintas-sekolah + @sms/cli
--                (operasi manual host). Bukan untuk request biasa.
--   app_user   : runtime tenant. Tanpa SET LOCAL app.school_id → buta total,
--                kecuali SELECT publik tabel School (by design).

DO $$ BEGIN
  CREATE ROLE app_user WITH LOGIN PASSWORD 'ganti-app-user-di-env';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE app_system WITH LOGIN BYPASSRLS PASSWORD 'ganti-app-system-di-env';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Perbaikan drift tabel yang SUDAH ada (idempotent, boleh di-rerun):
GRANT USAGE ON SCHEMA public TO app_user, app_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_system;

-- Hak default tabel MASA DEPAN (fase 2+). Dijalankan sebagai `sms`.
ALTER DEFAULT PRIVILEGES FOR ROLE sms IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE sms IN SCHEMA public
  GRANT ALL ON TABLES TO app_system;
ALTER DEFAULT PRIVILEGES FOR ROLE sms IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user, app_system;
-- CATATAN: default di atas memberi UPDATE/DELETE juga ke tabel append-only
-- masa depan. Setiap tabel append-only (seperti AuditLog) WAJIB mencabutnya
-- di migrasinya sendiri.
