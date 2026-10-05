import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";
import { revokeSession, clearCookieHeader } from "@/server/session";
import { logAuth } from "@/server/audit";

export async function POST(req: NextRequest) {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: "/api/auth/logout",
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (a.ok) {
    await revokeSession(a.sid, a.userId);
    if (a.school) {
      await logAuth(a.school.id, "AUTH.LOGOUT", { actorId: a.userId });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookieHeader());
  return res;
}
