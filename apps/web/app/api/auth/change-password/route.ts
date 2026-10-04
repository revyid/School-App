import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { doChangePassword } from "@/server/change-password";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const r = await doChangePassword({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    oldPassword: body?.oldPassword,
    newPassword: body?.newPassword,
  });
  if (!r.ok) {
    const res = NextResponse.json({ error: r.error }, { status: r.status });
    if (r.status === 429) res.headers.set("Retry-After", "60");
    return res;
  }
  return NextResponse.json({ ok: true });
}
