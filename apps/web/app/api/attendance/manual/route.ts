import { NextRequest, NextResponse } from "next/server";
import { apiGate } from "@/server/api-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { manualSchema, parseDay } from "@lacakedu/shared/attendance";
import { assertClassAccess } from "@/server/lms-scope";

// POST /api/attendance/manual {studentId, date, status, note?} — GURU/ADMIN.
// Guru hanya untuk siswa kelasnya. Tercatat editedBy + audit.
export async function POST(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU"]);
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
    if (!classId) return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
    const chk = await assertClassAccess(a.school.id, a.role, a.userId, classId);
    if (!chk.ok) return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: chk.status });
  }
  // Hari libur → absensi nonaktif.
  const liburManual = await runAsSchool(db, a.school.id, (tx) =>
    tx.academicCalendar.findFirst({
      where: { date: day, kind: "LIBUR", OR: [{ classId: null }, ...(classId ? [{ classId }] : [])] },
      select: { note: true },
    }),
  );
  if (liburManual) {
    return NextResponse.json({ error: "Hari libur — absensi nonaktif", holiday: true, note: liburManual.note }, { status: 403 });
  }
  // Izin yang sudah disetujui tidak boleh ditimpa jadi ALPHA (absensi berbohong).
  if (body.data.status === "ALPHA") {
    const approved = await runAsSchool(db, a.school.id, (tx) =>
      tx.leaveRequest.findFirst({
        where: { studentId: target.id, date: day, status: "APPROVED" },
        select: { id: true },
      }),
    );
    if (approved) {
      return NextResponse.json({ error: "Siswa punya izin disetujui pada tanggal ini" }, { status: 409 });
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
