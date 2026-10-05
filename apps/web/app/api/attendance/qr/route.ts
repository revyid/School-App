import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";

function newQrToken(): string {
  return `sms1-${randomBytes(16).toString("hex")}`;
}

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
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

// GET /api/attendance/qr?studentId= — token QR siswa.
// ADMIN boleh semua; GURU hanya kelasnya; SISWA hanya miliknya (untuk kartu QR).
// Token dibuat otomatis bila belum ada.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const studentId = ((new URL(req.url).searchParams.get("studentId") ?? "") || a.userId).slice(0, 64);
  if (a.role === "SISWA" && studentId !== a.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const target = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findFirst({
      where: { id: studentId, role: "SISWA" },
      select: {
        id: true, name: true, nisn: true,
        studentProfile: { select: { classId: true, class: { select: { name: true } } } },
      },
    }),
  );
  if (!target) return NextResponse.json({ error: "siswa tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }));
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }));
    const ids = new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
    const cid = target.studentProfile?.classId;
    if (!cid || !ids.has(cid)) return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
  }
  let qr = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentQr.findUnique({ where: { studentId: target.id } }),
  );
  if (!qr) {
    qr = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentQr.create({
        data: { schoolId: a.school.id, studentId: target.id, token: newQrToken() },
      }),
    );
    await logAuth(a.school.id, "QR.ISSUE", { actorId: a.userId, meta: { studentId: target.id } });
  }
  return NextResponse.json({
    qr: {
      token: qr.token,
      version: qr.version,
      student: { id: target.id, name: target.name, nisn: target.nisn, className: target.studentProfile?.class?.name ?? null },
    },
  });
}
