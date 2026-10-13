import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { buildTimetableWorkbook } from "@/server/timetable-xlsx";

// GET /api/timetable/export?classId= — .xlsx format sendiri Hari|Mulai|Selesai|Mapel|Guru (ADMIN/GURU).
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const classId = (new URL(req.url).searchParams.get("classId") ?? "").slice(0, 64);
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });
  const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: classId } }));
  if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  const slots = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where: { classId },
      include: {
        subjectRef: { select: { name: true } },
        teacher: { select: { name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 500,
    }),
  );
  const buf = buildTimetableWorkbook(
    slots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subjectRef?.name ?? s.subjectName,
      teacher: s.teacher?.name ?? "",
    })),
  );
  const safe = cls.name.replace(/[^\w\-]+/g, "-").slice(0, 32) || "kelas";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="jadwal-${safe}.xlsx"`,
      "x-content-type-options": "nosniff",
    },
  });
}
