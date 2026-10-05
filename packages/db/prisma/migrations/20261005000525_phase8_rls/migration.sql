-- Phase 8: RLS untuk ExpBadge, Announcement, CollabThread, CollabMessage.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ExpBadge','Announcement','CollabThread','CollabMessage'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON public.%I USING ("schoolId" = current_setting(%L)::text) WITH CHECK ("schoolId" = current_setting(%L)::text)', t, 'app.school_id', 'app.school_id');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_user', t);
  END LOOP;
END $$;

-- CATATAN: TIDAK ada policy publik untuk Announcement. Portal publik membaca via
-- runAsSchool(schoolId dari slug) sehingga tenant_isolation tetap membatasi per sekolah.
