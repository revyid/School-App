import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { schoolSlugFromHost } from "@sms/shared/school";
import { readSession, csrfOk } from "./session";

const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";
export const err = (status: number, error: string) => ({ ok: false as const, status, error });
export type Role = "ADMIN" | "GURU" | "SISWA" | "SUPER_ADMIN";

const MUST_CHANGE_ALLOW = [
  "/change-password",
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
];

function allowMustChange(pathname: string | undefined): boolean {
  if (!pathname) return false;
  return MUST_CHANGE_ALLOW.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function originOk(origin: string | null, referer: string | null, slug: string): boolean {
  const raw = origin ?? referer;
  if (!raw) return false;
  try {
    const got = new URL(raw).hostname.toLowerCase();
    const target = slug.toLowerCase();
    return (
      got === `${target}.${apex()}`.toLowerCase() ||
      got === `${target}.revy.my.id` ||
      got === `${target}.dev.revy.my.id` ||
      got === `${target}.localtest.me`
    );
  } catch {
    return false;
  }
}

export interface GateInput {
  host: string;
  token?: string;
  pathname?: string;
  mutation?: boolean;
  origin?: string | null;
  referer?: string | null;
  csrf?: string | null;
}

export async function authorize(o: GateInput) {
  // Cabang SUPER_ADMIN: Host admin.<apex>, sesi sch=admin/schoolId="".
  // Verifikasi via RPC definer (app_user tak bisa SELECT baris NULL).
  const hostbare = o.host.split(":")[0].trim().toLowerCase();
  if (hostbare === `admin.${apex()}`.toLowerCase()) {
    if (!o.token) return err(401, "unauthorized");
    const sess = await readSession(o.token);
    if (!sess || sess.sch !== "admin" || sess.schoolId !== "" || sess.role !== "SUPER_ADMIN") {
      return err(401, "unauthorized");
    }
    const rows = await db.$queryRaw<{ active: boolean; pwd_changed: Date | null; must_change: boolean }[]>`
      SELECT * FROM public.super_admin_active(${sess.userId})`;
    const r = rows[0];
    if (!r?.active) return err(401, "unauthorized");
    if (r.pwd_changed && Number(sess.iat) < new Date(r.pwd_changed).getTime()) {
      return err(401, "unauthorized");
    }
    if (o.mutation) {
      if (!originOk(o.origin ?? null, o.referer ?? null, "admin")) return err(403, "forbidden");
      if (!csrfOk(sess.csrf, o.csrf)) return err(403, "forbidden");
    }
    return {
      ok: true as const,
      school: null,
      userId: sess.userId,
      role: "SUPER_ADMIN" as Role,
      sid: o.token,
      csrf: sess.csrf,
      mustChangePassword: r.must_change,
    };
  }
  const slug = schoolSlugFromHost(o.host, apex());
  if (!slug) return err(404, "not found");
  const school = await db.school.findFirst({ where: { slug } });
  if (!school) return err(404, "not found");
  if (!o.token) return err(401, "unauthorized");
  const sess = await readSession(o.token);
  if (!sess || sess.schoolId !== school.id || sess.sch !== slug) return err(401, "unauthorized");
  const user = await runAsSchool(db, school.id, (tx) =>
    tx.user.findUnique({
      where: { id: sess.userId },
      select: { isActive: true, role: true, passwordChangedAt: true, mustChangePassword: true },
    }));
  if (!user?.isActive || user.role !== sess.role) return err(401, "unauthorized");
  if (user.passwordChangedAt && Number(sess.iat) < user.passwordChangedAt.getTime()) {
    return err(401, "unauthorized");
  }
  if (user.mustChangePassword && !allowMustChange(o.pathname)) {
    return err(403, "must-change-password");
  }
  if (o.mutation) {
    if (!originOk(o.origin ?? null, o.referer ?? null, slug)) return err(403, "forbidden");
    if (!csrfOk(sess.csrf, o.csrf)) return err(403, "forbidden");
  }
  return {
    ok: true as const,
    school,
    userId: sess.userId,
    role: sess.role as Role,
    sid: o.token,
    csrf: sess.csrf,
    mustChangePassword: user.mustChangePassword,
  };
}

// Guard API per role. Guard halaman: pakai helper di app/lib/require-page.ts.
//
// Overload agar pemanggil tenant (tanpa SUPER_ADMIN) tetap melihat school non-null
// tanpa mengubah 100+ route: runtime menolak SUPER_ADMIN bila tak diminta,
// lalu tipe menyempit via cast yang dijamin check di bawah.
type TenantAuth = {
  ok: true;
  school: { id: string; slug: string; name: string };
  userId: string;
  role: "ADMIN" | "GURU" | "SISWA";
  sid: string | undefined;
  csrf: string;
  mustChangePassword: boolean;
};
type SuperAuth = {
  ok: true;
  school: null;
  userId: string;
  role: "SUPER_ADMIN";
  sid: string | undefined;
  csrf: string;
  mustChangePassword: boolean;
};
export async function requireRole(
  o: GateInput & { roles: ["SUPER_ADMIN"] },
): Promise<SuperAuth | { ok: false; status: number; error: string }>;
export async function requireRole(
  o: GateInput & { roles: ("ADMIN" | "GURU" | "SISWA")[] },
): Promise<TenantAuth | { ok: false; status: number; error: string }>;
export async function requireRole(o: GateInput & { roles: Role[] }) {
  const a = await authorize(o);
  if (!a.ok) return a;
  if (!o.roles.includes(a.role)) return err(403, "forbidden");
  if (a.role === "SUPER_ADMIN" || a.school === null) {
    if (!o.roles.includes("SUPER_ADMIN")) return err(403, "forbidden");
    return a as unknown as SuperAuth;
  }
  return a as unknown as TenantAuth;
}
