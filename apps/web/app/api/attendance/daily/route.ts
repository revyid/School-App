import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { parseDay } from "@sms/shared/attendance";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/attendance/daily?date=YYYY-MM-DD&classId= — rekap harian per kelas.
// Guru otomatis dibatasi ke kelasnya bila classId tidak diisi? Tidak: classId wajib,
// dan guru yang bukan pengajar kelas itu ditolak.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const day = parseDay((url.searchParams.get("date") ?? "").slice(0, 10));
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  if (!day || !classId) return NextResponse.json({ error: "date & classId wajib diisi" }, { status: 400 });
  if (a.role === "GURU") {
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }));
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }));
    const ids = new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
    if (!ids.has(classId)) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
  }
  const students = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId },
      include: { user: { select: { id: true, name: true, nisn: true } } },
      orderBy: { user: { name: "asc" } },
      take: 500,
    }),
  );
  const recs = await runAsSchool(db, a.school.id, (tx) =>
    tx.attendanceRecord.findMany({
      where: { date: day, classId },
      select: { studentId: true, status: true, source: true, scannedAt: true, note: true },
    }),
  );
  const byId = new Map(recs.map((r) => [r.studentId, r]));
  const rows = students.map((s) => ({
    studentId: s.user.id,
    name: s.user.name,
    nisn: s.user.nisn,
    record: byId.get(s.user.id) ?? null,
  }));
  const summary = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0, BELUM: 0 };
  for (const r of rows) {
    if (r.record) summary[r.record.status as keyof typeof summary]++;
    else summary.BELUM++;
  }
  return NextResponse.json({ date: url.searchParams.get("date"), rows, summary });
}
