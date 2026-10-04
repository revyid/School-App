-- 0002_rls: fail-closed multi-tenancy. Dijalankan sebagai OWNER `sms` (superuser).
-- Superuser melewati RLS termasuk FORCE, jadi migrasi tidak buta. Runtime tidak
-- pernah memakai superuser: app_user selalu difilter, app_system via BYPASSRLS.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','Class','TeacherClass','StudentProfile','AuditLog','School'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Tabel tenant: scope penuh via SET LOCAL app.school_id (lihat tenant.ts).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User','Class','TeacherClass','StudentProfile','AuditLog'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user ' ||
      'USING ("schoolId" = current_setting(''app.school_id'', true)) ' ||
      'WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
  END LOOP;
END $$;

-- School: SELECT PUBLIK untuk app_user (USING (true)).
-- Alasan: web me-resolve slug subdomain TANPA koneksi privileged di hot path.
-- KONSEKUENSI: kolom School HANYA boleh berisi info direktori publik
-- (slug, nama, logo, lat/lng). JANGAN simpan rahasia per sekolah di tabel ini.
DROP POLICY IF EXISTS school_self_read ON "School";
DROP POLICY IF EXISTS school_public_read ON "School";
CREATE POLICY school_public_read ON "School" FOR SELECT TO app_user USING (true);

-- Grants minimal (REVOKE ALL dulu agar rerun idempotent).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON "User", "Class", "TeacherClass", "StudentProfile" TO app_user;
GRANT SELECT, INSERT ON "AuditLog" TO app_user;
REVOKE UPDATE, DELETE ON "AuditLog" FROM app_user;
GRANT SELECT ON "School" TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_system;

-- Login email case-insensitive per sekolah (tidak mencakup SUPER_ADMIN global).
CREATE UNIQUE INDEX IF NOT EXISTS "User_school_email_lower_uniq"
  ON "User" ("schoolId", lower(email)) WHERE email IS NOT NULL AND "schoolId" IS NOT NULL;
DROP INDEX IF EXISTS "User_school_nisn_uniq";
-- Email SUPER_ADMIN global (schoolId NULL): index parsial sendiri.
CREATE UNIQUE INDEX IF NOT EXISTS "User_superadmin_email_lower_uniq"
  ON "User" (lower(email)) WHERE "schoolId" IS NULL AND email IS NOT NULL;
