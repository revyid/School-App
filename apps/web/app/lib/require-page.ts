// Helper halaman/data-access: authorize + ambil profil + tentukan redirect tujuan.
// Dipakai SEMUA layout (dash/admin/guru/siswa) agar perilaku konsisten:
// "must-change-password" -> /change-password, selain itu -> /login.
//
// F4: getPageAuth dibungkus React.cache — satu navigasi = SATU authorize +
// satu query user + satu query settings (sebelumnya 2× karena dipanggil
// layout (dash) DAN layout peran).
import { cache } from "react";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { ROLE_HOME, SESSION_COOKIE } from "@sms/shared/auth";
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
  // Layout dash = tenant saja; super-admin tak masuk sini.
  if (!a.school) return { ok: false as const, redirectTo: "/login" };
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
  const st = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.findUnique({
      where: { schoolId: a.school.id },
      select: { portalName: true },
    })).catch(() => null);
  const portal = st?.portalName?.trim() ? st.portalName.trim() : a.school.name;
  return { ok: true as const, me, schoolName: portal, schoolSlug: a.school.slug, home };
}

export type PageAuth = Awaited<ReturnType<typeof requirePage>>;

// F4: hasil authorize per request DI-CACHE (React cache) — layout peran
// tinggal membaca tanpa menimbulkan query kedua.
export const getPageAuth = cache(async (): Promise<PageAuth> => {
  const { headers, cookies } = await import("next/headers");
  const h = await headers();
  const c = await cookies();
  return requirePage({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: h.get("x-pathname") ?? "/",
  });
});