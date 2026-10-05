import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { originOk } from "@/server/auth-gate";
import { cookieHeader } from "@/server/session";
import { attemptSuperAdminLogin, AuthError } from "@/server/super-login";

const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";
const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

const bodySchema = z.object({
  email: z.string().trim().email().max(128),
  password: z.string().min(1).max(256),
});

// POST /api/auth/admin-login — HANYA via Host admin.<apex>.
export async function POST(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const h = host.split(":")[0].trim().toLowerCase();
  if (h !== `admin.${apex()}`.toLowerCase()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!originOk(req.headers.get("origin"), req.headers.get("referer"), "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
  try {
    const r = await attemptSuperAdminLogin({ email: body.data.email, password: body.data.password, ip: ip(req) });
    const res = NextResponse.json({ user: r.user, csrfToken: r.csrf, mustChangePassword: r.mustChangePassword });
    res.headers.set("Set-Cookie", cookieHeader(r.sid));
    return res;
  } catch (e) {
    if (e instanceof AuthError) {
      const res = NextResponse.json({ error: e.message }, { status: e.status });
      if (e.status === 429) res.headers.set("Retry-After", "60");
      return res;
    }
    return NextResponse.json({ error: "Email atau kata sandi salah" }, { status: 401 });
  }
}
