-- Phase 3: RLS untuk AttendanceRecord, AcademicCalendar, StudentQr.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['AttendanceRecord','AcademicCalendar','StudentQr'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user ' ||
      'USING ("schoolId" = current_setting(''app.school_id'', true)) ' ||
      'WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
  END LOOP;
END $$;

REVOKE ALL ON "AttendanceRecord", "AcademicCalendar", "StudentQr" FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "AttendanceRecord", "AcademicCalendar", "StudentQr" TO app_user;
GRANT ALL ON "AttendanceRecord", "AcademicCalendar", "StudentQr" TO app_system;
