import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { taskPatchSchema, isVisibleToStudent, submitState } from "@sms/shared/lms";
import { guruClassIds, siswaClassId } from "@/server/lms-scope";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

async function loadTask(schoolId: string, id: string) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.task.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        materials: { select: { id: true, kind: true, text: true, fileName: true, mime: true, size: true, createdAt: true } },
      },
    }));
}

// GET /api/tasks/[id] — detail + (siswa) status pengumpulannya.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await loadTask(a.school.id, id.slice(0, 64));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const now = new Date();
  if (a.role === "SISWA") {
    const cid = await siswaClassId(a.school.id, a.userId);
    if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (!isVisibleToStudent(t, now)) return NextResponse.json({ error: "tugas belum dipublikasikan" }, { status: 404 });
    const sub = await runAsSchool(db, a.school.id, (tx) =>
      tx.submission.findUnique({ where: { taskId_studentId: { taskId: t.id, studentId: a.userId } } }));
    return NextResponse.json({
      task: { ...t, author: { name: t.author.name } },
      submission: sub,
      state: submitState(t, sub?.submittedAt ?? null, now),
    });
  }
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const subs = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findMany({
      where: { taskId: t.id },
      include: { student: { select: { id: true, name: true, nisn: true } } },
      orderBy: { submittedAt: "desc" },
      take: 500,
    }));
  const roster = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId },
      include: { user: { select: { id: true, name: true, nisn: true } } },
      take: 500,
    }));
  const done = new Set(subs.map((s) => s.studentId));
  return NextResponse.json({
    task: t,
    visible: isVisibleToStudent(t, now),
    submissions: subs,
    pending: roster.filter((r) => !done.has(r.user.id)).map((r) => r.user),
  });
}

// PATCH /api/tasks/[id] — GURU (kelasnya, atau penulisnya) / ADMIN.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await loadTask(a.school.id, id.slice(0, 64));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId) && t.authorId !== a.userId) {
      return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    }
  }
  const body = taskPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  if (body.data.classId) {
    const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId! } }));
    if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.update({
      where: { id: t.id },
      data: {
        ...(body.data.classId ? { classId: body.data.classId } : {}),
        ...(body.data.subjectId !== undefined ? { subjectId: body.data.subjectId } : {}),
        ...(body.data.title ? { title: body.data.title } : {}),
        ...(body.data.instruction ? { instruction: body.data.instruction } : {}),
        ...(body.data.type ? { type: body.data.type } : {}),
        ...(body.data.deadline !== undefined ? { deadline: body.data.deadline ? new Date(body.data.deadline) : null } : {}),
        ...(body.data.publishAt !== undefined ? { publishAt: body.data.publishAt ? new Date(body.data.publishAt) : new Date() } : {}),
        ...(body.data.allowLate !== undefined ? { allowLate: body.data.allowLate } : {}),
        ...(body.data.isGroup !== undefined ? { isGroup: body.data.isGroup } : {}),
      },
    }));
  await logAuth(a.school.id, "TASK.UPDATE", { actorId: a.userId, meta: { id: t.id } });
  return NextResponse.json({ task: row });
}

// DELETE /api/tasks/[id] — ADMIN saja (guru: arsip via publishAt? dihapus hanya admin).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.task.delete({ where: { id: id.slice(0, 64) } }));
  } catch {
    return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  }
  await logAuth(a.school.id, "TASK.DELETE", { actorId: a.userId, meta: { id } });
  return NextResponse.json({ ok: true });
}
