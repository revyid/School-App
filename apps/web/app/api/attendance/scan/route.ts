import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { scanSchema, SCAN_COOLDOWN_SEC, parseDay, scanDecision, todayWib } from "@sms/shared/attendance";
import { publishScan } from "@/server/realtime";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

function teacherClasses(a: { role: string; userId: string }, schoolId: string) {
  return (async () => {
    if (a.role !== "GURU") return null;
    const mine = await runAsSchool(db, schoolId, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }));
    const homeroom = await runAsSchool(db, schoolId, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }));
    return new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
  })();
}

// POST /api/attendance/scan {token} — GURU/ADMIN. Idempoten + cooldown 60 dtk.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:scan:${a.school.id}:${a.userId}`, 120, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu banyak scan, coba lagi nanti" }, { status: 429 });
  const body = scanSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "token tidak valid" }, { status: 400 });

  const qr = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentQr.findUnique({
      where: { token: body.data.token },
      include: {
        student: {
          select: {
            id: true, name: true, isActive: true, role: true,
            studentProfile: { select: { classId: true, class: { select: { name: true } } } },
          },
        },
      },
    }),
  );
  if (!qr || qr.student.role !== "SISWA" || !qr.student.isActive) {
    return NextResponse.json({ error: "QR tidak dikenal" }, { status: 404 });
  }
  const classId = qr.student.studentProfile?.classId ?? null;
  if (a.role === "GURU") {
    const mine = await teacherClasses(a, a.school.id);
    if (!classId || !mine?.has(classId)) {
      return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
    }
  }

  const day = todayWib();
  const now = new Date();
  const existing = await runAsSchool(db, a.school.id, (tx) =>
    tx.attendanceRecord.findUnique({
      where: { schoolId_studentId_date: { schoolId: a.school.id, studentId: qr.student.id, date: day } },
    }),
  );
  const dec = scanDecision(
    existing ? { status: existing.status, scannedAt: existing.scannedAt } : null,
    now,
    SCAN_COOLDOWN_SEC,
  );
  if (!dec.ok) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      reason: dec.reason,
      student: { id: qr.student.id, name: qr.student.name },
    });
  }

  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.attendanceRecord.upsert({
      where: { schoolId_studentId_date: { schoolId: a.school.id, studentId: qr.student.id, date: day } },
      update: { status: "HADIR", source: "SCAN", scannedAt: now, classId, editedById: null, note: null },
      create: {
        schoolId: a.school.id, studentId: qr.student.id, classId, date: day,
        status: "HADIR", source: "SCAN", scannedAt: now,
      },
    }),
  );
  await logAuth(a.school.id, "ATT.SCAN", { actorId: a.userId, meta: { studentId: qr.student.id } });
  const className = qr.student.studentProfile?.class?.name ?? null;
  publishScan({
    schoolId: a.school.id,
    studentId: qr.student.id,
    name: qr.student.name,
    className,
    scannedAt: now.toISOString(),
  }).catch(() => {});
  return NextResponse.json({
    ok: true,
    duplicate: false,
    student: { id: qr.student.id, name: qr.student.name, className },
    recordId: row.id,
  });
}
