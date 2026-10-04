-- Phase 7: RLS untuk Assessment, Question, AssessQuestion, AssessAttempt,
-- AssessAnswer, StudyGroup, StudyGroupMember, ExpLog.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['Assessment','Question','AssessQuestion','AssessAttempt','AssessAnswer','StudyGroup','StudyGroupMember','ExpLog'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I USING ("schoolId" = current_setting(%L)::text) WITH CHECK ("schoolId" = current_setting(%L)::text)', t, 'app.school_id', 'app.school_id');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
  END LOOP;
END $$;
