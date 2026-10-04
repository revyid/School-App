import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { schoolSlugFromHost } from "@sms/shared/school";
import { readSession, csrfOk } from "./session";

const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";
export const err = (status: number, error: string) => ({ ok: false as const, status, error });
export type Role = "ADMIN" | "GURU" | "SISWA";

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
  const want = `${slug}.${apex()}`.toLowerCase();
  const raw = origin ?? referer;
  if (!raw) return false;
  try {
    return new URL(raw).hostname.toLowerCase() === want;
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
export async function requireRole(o: GateInput & { roles: Role[] }) {
  const a = await authorize(o);
  if (!a.ok) return a;
  if (!o.roles.includes(a.role)) return err(403, "forbidden");
  return a;
}
