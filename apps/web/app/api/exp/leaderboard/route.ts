import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { classLeaderboard, studentExp } from "@/server/exp";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/exp/leaderboard?classId= — semua role login (per kelas).
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });
  if (a.role === "GURU") {
    const { guruClassIds } = await import("@/server/lms-scope");
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(classId)) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
  }
  if (a.role === "SISWA") {
    const p = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (!p?.classId || p.classId !== classId) {
      return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    }
  }
  const rows = await classLeaderboard(a.school.id, classId, 20);
  return NextResponse.json({ rows });
}
