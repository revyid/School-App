// Helper halaman/data-access: authorize + ambil profil + tentukan redirect tujuan.
// Dipakai SEMUA layout (dash/admin/guru/siswa) agar perilaku konsisten:
// "must-change-password" -> /change-password, selain itu -> /login.
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { ROLE_HOME } from "@sms/shared/auth";
import { authorize, type Role } from "@/server/auth-gate";

export interface PageInput {
  host: string;
  token?: string;
  pathname?: string;
  roles?: Role[];
}

export async function requirePage(o: PageInput) {
  const a = await authorize({ host: o.host, token: o.token, pathname: o.pathname });
  if (!a.ok) {
    return {
      ok: false as const,
      redirectTo: a.error === "must-change-password" ? "/change-password" : "/login",
    };
  }
  if (o.roles && !o.roles.includes(a.role)) {
    const home = ROLE_HOME[a.role as keyof typeof ROLE_HOME] ?? "/siswa";
    return { ok: false as const, redirectTo: a.mustChangePassword ? "/change-password" : home };
  }
  const me = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({
      where: { id: a.userId },
      select: { id: true, name: true, role: true, email: true, mustChangePassword: true },
    }));
  if (!me) return { ok: false as const, redirectTo: "/login" };
  if (me.mustChangePassword && o.pathname !== "/change-password") {
    return { ok: false as const, redirectTo: "/change-password" };
  }
  const home = ROLE_HOME[a.role as keyof typeof ROLE_HOME] ?? "/siswa";
  return { ok: true as const, me, schoolName: a.school.name, schoolSlug: a.school.slug, home };
}
