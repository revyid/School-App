import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";

export async function GET(req: NextRequest) {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: "/api/auth/me",
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  // SUPER_ADMIN: tidak punya sekolah, tapi klien tetap butuh csrfToken untuk mutasi.
  if (!a.school) {
    return NextResponse.json({
      user: { id: a.userId, name: "Super Admin", role: "SUPER_ADMIN", email: null, mustChangePassword: a.mustChangePassword },
      school: null,
      csrfToken: a.csrf,
    });
  }
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
