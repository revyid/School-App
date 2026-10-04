-- Phase 4: RLS untuk Task, TaskMaterial, Submission.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Task','TaskMaterial','Submission'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("schoolId" = current_setting(%L)) WITH CHECK ("schoolId" = current_setting(%L))', t, 'app.school_id', 'app.school_id');
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Task" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "TaskMaterial" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Submission" TO app_user;
