import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";

// GET /api/root/analytics — SUPER_ADMIN: agregat platform 30 hari terakhir.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const root = getRootDb();
  const [user, student, teacher, classCount, submission, task, attendance, leaveRequest, announcement, attendanceByDay, newUsersByDay] =
    await Promise.all([
      root.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
      root.studentProfile.count(),
      root.user.count({ where: { role: "GURU" } }),
      root.class.count(),
      root.submission.count(),
      root.task.count(),
      root.attendanceRecord.count(),
      root.leaveRequest.count(),
      root.announcement.count(),
      // Absensi nyata per hari (bukan pengguna baru).
      root.$queryRaw<{ date: string; value: number; present: number }[]>`
        SELECT to_char(date_trunc('day', "date"), 'YYYY-MM-DD') AS date,
               COUNT(*)::int AS value,
               COUNT(*) FILTER (WHERE status = 'HADIR')::int AS present
        FROM "AttendanceRecord"
        WHERE "date" >= current_date - interval '29 days'
        GROUP BY 1 ORDER BY 1`,
      // Pengguna baru per hari (dipisah dari absensi).
      root.$queryRaw<{ date: string; value: number }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
        FROM "User"
        WHERE "createdAt" >= now() - interval '30 days' AND role <> 'SUPER_ADMIN'
        GROUP BY 1 ORDER BY 1`,
    ]);

  return NextResponse.json({
    period: "30d",
    counts: {
      user,
      student,
      teacher,
      class: classCount,
      submission,
      task,
      attendance,
      leaveRequest,
      announcement,
    },
    attendanceByDay,
    newUsersByDay,
  });
}
