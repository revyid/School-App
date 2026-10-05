import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { manualSchema, parseDay } from "@sms/shared/attendance";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// POST /api/attendance/manual {studentId, date, status, note?} — GURU/ADMIN.
// Guru hanya untuk siswa kelasnya. Tercatat editedBy + audit.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = manualSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const day = parseDay(body.data.date);
  if (!day) return NextResponse.json({ error: "tanggal tidak valid" }, { status: 400 });

  const target = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findFirst({
      where: { id: body.data.studentId, role: "SISWA" },
      select: { id: true, isActive: true, studentProfile: { select: { classId: true } } },
    }),
  );
  if (!target || !target.isActive) return NextResponse.json({ error: "siswa tidak ditemukan" }, { status: 404 });
  const classId = target.studentProfile?.classId ?? null;
  if (a.role === "GURU") {
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }));
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }));
    const ids = new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
    if (!classId || !ids.has(classId)) {
      return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
    }
  }

  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.attendanceRecord.upsert({
      where: { schoolId_studentId_date: { schoolId: a.school.id, studentId: target.id, date: day } },
      update: {
        status: body.data.status, source: "MANUAL", classId,
        editedById: a.userId, note: body.data.note ?? null, scannedAt: null,
      },
      create: {
        schoolId: a.school.id, studentId: target.id, classId, date: day,
        status: body.data.status, source: "MANUAL",
        editedById: a.userId, note: body.data.note ?? null,
      },
    }),
  );
  await logAuth(a.school.id, "ATT.MANUAL", {
    actorId: a.userId, meta: { studentId: target.id, date: body.data.date, status: body.data.status },
  });
  return NextResponse.json({ ok: true, recordId: row.id });
}
