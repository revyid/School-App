-- Phase 2: RLS untuk tabel tenant baru (Subject, SchoolSettings, TimetableSlot, ImportBatch).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Subject','SchoolSettings','TimetableSlot','ImportBatch'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user ' ||
      'USING ("schoolId" = current_setting(''app.school_id'', true)) ' ||
      'WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
  END LOOP;
END $$;

REVOKE ALL ON "Subject", "SchoolSettings", "TimetableSlot", "ImportBatch" FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Subject", "TimetableSlot", "ImportBatch" TO app_user;
GRANT SELECT, INSERT, UPDATE ON "SchoolSettings" TO app_user;
REVOKE DELETE ON "SchoolSettings" FROM app_user;
GRANT ALL ON "Subject", "SchoolSettings", "TimetableSlot", "ImportBatch" TO app_system;
