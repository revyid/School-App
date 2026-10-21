-- Audit percobaan login SUPER_ADMIN (level platform, tanpa sekolah).
-- AuditLog punya FK schoolId NOT NULL, sedangkan akun root tidak punya
-- sekolah -> percobaan login root (termasuk brute force) tidak punya jejak.
CREATE TABLE IF NOT EXISTS "RootAuthAttempt" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"      TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "ip"         TEXT,
  "meta"       JSONB NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "RootAuthAttempt_createdAt_idx" ON "RootAuthAttempt" ("createdAt" DESC);

-- Hanya app_root (koneksi root) boleh menulis; app_user tidak perlu akses.
GRANT SELECT, INSERT, UPDATE, DELETE ON "RootAuthAttempt" TO app_root;
REVOKE ALL ON "RootAuthAttempt" FROM app_user;
