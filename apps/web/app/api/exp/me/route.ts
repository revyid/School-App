import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { studentExp } from "@/server/exp";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/exp/me — total EXP + badge milik siswa ini.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const points = await studentExp(a.school.id, a.userId);
  const badges = await runAsSchool(db, a.school.id, (tx) =>
    tx.expBadge.findMany({ where: { studentId: a.userId }, select: { name: true, awardedAt: true }, take: 50 }));
  return NextResponse.json({ points, badges });
}
