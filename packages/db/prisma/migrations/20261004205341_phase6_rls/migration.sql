-- Phase 6: RLS untuk LeaveRequest, CaptureSession, ParentalConsent, PrivacyPolicy.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['LeaveRequest','CaptureSession','ParentalConsent','PrivacyPolicy'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user ' ||
      'USING ("schoolId" = current_setting(''app.school_id'', true)) ' ||
      'WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
  END LOOP;
END $$;

REVOKE ALL ON "LeaveRequest", "CaptureSession", "ParentalConsent", "PrivacyPolicy" FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "LeaveRequest", "CaptureSession", "ParentalConsent", "PrivacyPolicy" TO app_user;
GRANT ALL ON "LeaveRequest", "CaptureSession", "ParentalConsent", "PrivacyPolicy" TO app_system;
