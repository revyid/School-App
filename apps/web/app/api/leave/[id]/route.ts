import { stat, readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { reviewSchema } from "@sms/shared/leave";
import { leavePhotoPath } from "@/server/leave-photos";
import { guruClassIds } from "@/server/lms-scope";
import { enqueueOutbox } from "@/server/outbox";

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

async function scopeOk(schoolId: string, role: string, userId: string, studentId: string, classIdOf?: string | null): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role === "SISWA") return studentId === userId;
  // GURU: wali kelas / pengajar kelas siswa tersebut.
  const mine = await guruClassIds(schoolId, userId);
  if (classIdOf) return mine.has(classIdOf);
  const p = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } }));
  return !!p?.classId && mine.has(p.classId);
}

// POST /api/leave/[id]/review {decision, note?} — GURU (kelasnya) / ADMIN.
// APPROVED: catat reviewedAt; auto-alpha Phase 3+6 menghormati via approvedLeave (di bawah).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = reviewSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const lr = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.findUnique({
      where: { id: id.slice(0, 64) },
      include: { student: { select: { studentProfile: { select: { classId: true } } } } },
    }));
  if (!lr) return NextResponse.json({ error: "pengajuan tidak ditemukan" }, { status: 404 });
  if (!(await scopeOk(a.school.id, a.role, a.userId, lr.studentId, lr.student.studentProfile?.classId))) {
    return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
  }
  const now = new Date();
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.update({
      where: { id: lr.id },
      data: {
        status: body.data.decision, reviewerId: a.userId,
        reviewNote: body.data.note ?? null, reviewedAt: now,
      },
    }));
  await logAuth(a.school.id, "LEAVE.REVIEW", {
    actorId: a.userId, meta: { id: lr.id, decision: body.data.decision },
  });
  // Opsional: WA ke ortu bila APPROVED (via outbox, dedupe per leave id).
  if (body.data.decision === "APPROVED") {
    const prof = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: lr.studentId }, select: { parentPhone: true } }));
    if (prof?.parentPhone) {
      await enqueueOutbox(a.school.id, prof.parentPhone,
        `Pengajuan izin tanggal ${lr.date.toISOString().slice(0, 10)} DISETUJUI. Terima kasih.`,
        `leave-ok-${lr.id}`).catch(() => {});
    }
  }
  return NextResponse.json({ leave: { ...row, studentPhoto: undefined, parentPhoto: undefined } });
}

// GET /api/leave/[id]/photo?which=siswa|ortu — stream foto (otorisasi + audit baca).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const which = new URL(req.url).searchParams.get("which") === "ortu" ? "parentPhoto" : "studentPhoto";
  const lr = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.findUnique({
      where: { id: id.slice(0, 64) },
      include: { student: { select: { studentProfile: { select: { classId: true } } } } },
    }));
  if (!lr) return NextResponse.json({ error: "pengajuan tidak ditemukan" }, { status: 404 });
  if (!(await scopeOk(a.school.id, a.role, a.userId, lr.studentId, lr.student.studentProfile?.classId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const name = which === "parentPhoto" ? lr.parentPhoto : lr.studentPhoto;
  if (!name) return NextResponse.json({ error: "foto tidak ada" }, { status: 404 });
  let abs: string;
  try {
    abs = leavePhotoPath(a.school.id, name);
  } catch {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }
  let st;
  try {
    st = await stat(abs);
  } catch {
    return NextResponse.json({ error: "file tidak ditemukan" }, { status: 404 });
  }
  const buf = await readFile(abs);
  await logAuth(a.school.id, "LEAVE.PHOTO_ACCESS", { actorId: a.userId, meta: { id: lr.id, which } });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": name.endsWith(".png") ? "image/png" : "image/jpeg",
      "content-length": String(st.size),
      "content-disposition": 'attachment; filename="foto-izin"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
