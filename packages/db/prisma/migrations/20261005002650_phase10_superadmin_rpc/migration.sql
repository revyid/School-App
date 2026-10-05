-- Phase 10: RPC kredensial SUPER_ADMIN (SECURITY DEFINER, milik owner).
-- Web berjalan sebagai app_user (TANPA SYSTEM_URL): satu-satunya jalan membaca
-- baris User schoolId NULL adalah fungsi ini — hanya untuk email persis,
-- hanya role SUPER_ADMIN + aktif, tanpa membuka tabel ke SELECT langsung.
CREATE OR REPLACE FUNCTION public.super_admin_cred(p_email text)
RETURNS TABLE(id text, password_hash text, must_change boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "User"."id", "User"."passwordHash", "User"."mustChangePassword"
  FROM "User"
  WHERE "User"."schoolId" IS NULL
    AND "User"."role" = 'SUPER_ADMIN'
    AND "User"."isActive" = true
    AND lower("User"."email") = lower(p_email)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.super_admin_cred(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_cred(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.super_admin_cred(text) TO app_system;
