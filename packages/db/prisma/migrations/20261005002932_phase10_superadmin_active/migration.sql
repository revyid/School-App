-- Phase 10: cek sesi super-admin (SECURITY DEFINER, milik owner).
-- Tanpa fungsi ini, app_user buta terhadap baris User schoolId NULL (RLS).
CREATE OR REPLACE FUNCTION public.super_admin_active(p_id text)
RETURNS TABLE(active boolean, pwd_changed timestamptz, must_change boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "User"."isActive", "User"."passwordChangedAt", "User"."mustChangePassword"
  FROM "User"
  WHERE "User"."id" = p_id
    AND "User"."schoolId" IS NULL
    AND "User"."role" = 'SUPER_ADMIN'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.super_admin_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_active(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.super_admin_active(text) TO app_system;
