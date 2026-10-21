-- Root/platform layer (Lingkungan Super-Admin).
-- Jalankan sebagai superuser `sms` (owner tabel), SEBELUM prisma migrate:
--   psql -U sms -d smsdb -f migration.sql
-- Kredensial app_root dipakai HANYA oleh root client web (ROOT_DATABASE_URL,
-- lihat packages/db/src/root.ts) untuk baca lintas-sekolah. Bukan koneksi publik.
-- KEAMANAN: password di bawah PLACEHOLDER — deployer WAJIB menggantinya dan
-- menyuntikkan nilainya lewat secret ROOT_DATABASE_URL. Jangan commit password asli.

-- 1. Role app_root: LOGIN + BYPASSRLS. Idempotent; rerun hanya menyamakan flag,
--    password yang sudah dirotasi TIDAK di-reset.
DO $$ BEGIN
  CREATE ROLE app_root WITH LOGIN BYPASSRLS PASSWORD 'change-me-in-production';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER ROLE app_root WITH LOGIN BYPASSRLS;

GRANT USAGE ON SCHEMA public TO app_root;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_root;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_root;

-- 2. Tabel masa depan otomatis terbaca app_root tanpa migrasi baru.
ALTER DEFAULT PRIVILEGES FOR ROLE sms IN SCHEMA public
  GRANT ALL ON TABLES TO app_root;
ALTER DEFAULT PRIVILEGES FOR ROLE sms IN SCHEMA public
  GRANT ALL ON SEQUENCES TO app_root;

-- 3. RootSettings: setelan platform (bukan milik sekolah). Tanpa RLS karena
--    satu-satunya jalur akses adalah app_root (BYPASSRLS).
CREATE TABLE IF NOT EXISTS "RootSettings" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL UNIQUE,
  "value"      JSONB NOT NULL DEFAULT '{}',
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO "RootSettings" ("key", "value")
VALUES ('heroImageUrl', 'null'::jsonb), ('heroAlt', 'null'::jsonb),
       ('platformName', to_jsonb('SMS-LMS'::text)), ('platformTagline', to_jsonb('Satu platform untuk semua sekolah'::text))
ON CONFLICT ("key") DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON "RootSettings" TO app_root;

-- Default privileges (scripts/db-create-roles.sql) memberi app_user akses ke
-- semua tabel baru; cabut agar app_user tetap buta terhadap tabel platform ini.
REVOKE ALL ON "RootSettings" FROM app_user;

ALTER TABLE "RootSettings" DISABLE ROW LEVEL SECURITY;
