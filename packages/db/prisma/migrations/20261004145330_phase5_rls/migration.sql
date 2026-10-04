-- Phase 5: RLS untuk Notification, MessageOutbox (pola phase2: fail-closed).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Notification','MessageOutbox'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I FOR ALL TO app_user ' ||
      'USING ("schoolId" = current_setting(''app.school_id'', true)) ' ||
      'WITH CHECK ("schoolId" = current_setting(''app.school_id'', true))', t);
  END LOOP;
END $$;

REVOKE ALL ON "Notification", "MessageOutbox" FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Notification", "MessageOutbox" TO app_user;
GRANT ALL ON "Notification", "MessageOutbox" TO app_system;
