import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@sms/shared/auth";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { attemptLogin, AuthError } from "@/server/login";
import { originOk } from "@/server/auth-gate";
import { cookieHeader } from "@/server/session";

const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";
const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, apex());
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!originOk(req.headers.get("origin"), req.headers.get("referer"), slug)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const school = await db.school.findFirst({ where: { slug } });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = loginSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Email/NISN atau kata sandi salah" }, { status: 401 });
  try {
    const r = await attemptLogin({
      schoolId: school.id,
      schoolSlug: slug,
      identifier: body.data.identifier,
      password: body.data.password,
      ip: ip(req),
    });
    const res = NextResponse.json({ user: r.user, csrfToken: r.csrf, mustChangePassword: r.mustChangePassword });
    res.headers.set("Set-Cookie", cookieHeader(r.sid));
    return res;
  } catch (e) {
    if (e instanceof AuthError) {
      const res = NextResponse.json({ error: e.message }, { status: e.status });
      if (e.status === 429) res.headers.set("Retry-After", "60");
      return res;
    }
    return NextResponse.json({ error: "Email/NISN atau kata sandi salah" }, { status: 401 });
  }
}
