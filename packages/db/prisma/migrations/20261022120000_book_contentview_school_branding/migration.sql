-- Fase 1: fondasi data.
--   1. Book        : ebook (link / upload file / paste markdown). schoolId NULL = buku platform.
--   2. ContentView : penghitung view per hari (TOTAL, bukan unik).
--   3. SchoolSettings: kolom branding per sekolah (karakter, hero, banner, warna, tema).
--
-- Jalankan sebagai owner tabel `sms`:
--   psql -U sms -d smsdb -f migration.sql
--
-- Hak akses:
--   - app_user: default privilege (db-create-roles.sql) sudah memberi CRUD; tabel ini
--     dikunci RLS per sekolah, jadi tenant hanya melihat/menulis baris sekolahnya.
--   - app_root : default privilege (root_role_root_settings) memberi ALL; role ini
--     BYPASSRLS sehingga root console bisa lintas sekolah.

-- 1. Kolom branding per sekolah ------------------------------------------------
ALTER TABLE "SchoolSettings"
  ADD COLUMN IF NOT EXISTS "characterImageUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "heroImageUrl"       TEXT,
  ADD COLUMN IF NOT EXISTS "dashboardBannerUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "brandColor"         TEXT,
  ADD COLUMN IF NOT EXISTS "portalTheme"        TEXT NOT NULL DEFAULT 'default';

-- 2. Tabel Book -----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "BookSource" AS ENUM ('LINK', 'UPLOAD', 'MARKDOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Book" (
  "id"          TEXT PRIMARY KEY,
  "schoolId"    TEXT,
  "title"       VARCHAR(200) NOT NULL,
  "author"      VARCHAR(160),
  "coverUrl"    TEXT,
  "source"      "BookSource" NOT NULL,
  "url"         TEXT,
  "fileKey"     TEXT,
  "bodyMd"      TEXT,
  "mimeType"    VARCHAR(128),
  "sizeBytes"   INTEGER,
  "published"   BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Book_schoolId_published_idx" ON "Book" ("schoolId", "published");
CREATE INDEX IF NOT EXISTS "Book_createdAt_idx" ON "Book" ("createdAt");
DO $$ BEGIN
  ALTER TABLE "Book" ADD CONSTRAINT "Book_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Book" ADD CONSTRAINT "Book_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabel ContentView -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ContentView" (
  "id"       TEXT PRIMARY KEY,
  "schoolId" TEXT NOT NULL,
  "kind"     VARCHAR(32) NOT NULL,
  "entityId" VARCHAR(64) NOT NULL,
  "day"      DATE NOT NULL,
  "count"    INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContentView_schoolId_kind_entityId_day_key"
  ON "ContentView" ("schoolId", "kind", "entityId", "day");
CREATE INDEX IF NOT EXISTS "ContentView_schoolId_day_idx" ON "ContentView" ("schoolId", "day");
DO $$ BEGIN
  ALTER TABLE "ContentView" ADD CONSTRAINT "ContentView_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. RLS ------------------------------------------------------------------------
-- Book: tenant boleh BACA buku platform (schoolId NULL) dan buku sekolahnya,
-- tapi hanya boleh MENYUNTIK/MENGUBAH buku sekolahnya sendiri (schoolId wajib
-- milik tenant, bukan NULL) -> platform book hanya boleh dibuat lewat app_root.
ALTER TABLE "Book" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Book" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON "Book";
DROP POLICY IF EXISTS tenant_write ON "Book";
CREATE POLICY tenant_read ON "Book" FOR SELECT
  USING ("schoolId" IS NULL OR "schoolId" = current_setting('app.school_id')::text);
CREATE POLICY tenant_write ON "Book" FOR ALL
  USING ("schoolId" = current_setting('app.school_id')::text)
  WITH CHECK ("schoolId" = current_setting('app.school_id')::text);

-- ContentView: murni data sekolah (counter per hari).
ALTER TABLE "ContentView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentView" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ContentView";
CREATE POLICY tenant_isolation ON "ContentView"
  USING ("schoolId" = current_setting('app.school_id')::text)
  WITH CHECK ("schoolId" = current_setting('app.school_id')::text);

-- 5. Grant eksplisit (default privilege sudah mencakup, tapi dinormalkan agar
--    migrasi ini berdiri sendiri).
GRANT SELECT, INSERT, UPDATE, DELETE ON "Book" TO app_user, app_root;
GRANT SELECT, INSERT, UPDATE, DELETE ON "ContentView" TO app_user, app_root;
GRANT USAGE ON TYPE "BookSource" TO app_user, app_root;
