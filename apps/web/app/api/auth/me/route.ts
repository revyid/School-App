import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

export async function GET(req: NextRequest) {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: "/api/auth/me",
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  if (!a.school) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({
      where: { id: a.userId },
      select: { id: true, name: true, role: true, email: true, mustChangePassword: true },
    }));
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    user: me,
    school: { id: a.school.id, slug: a.school.slug, name: a.school.name },
    csrfToken: a.csrf,
  });
}
