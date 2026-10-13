import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { taskPatchSchema, taskTargetPatchSchema, isVisibleToStudent, submitState } from "@sms/shared/lms";
import { guruClassIds, siswaClassId } from "@/server/lms-scope";
import { canManageTask, notifyTaskChange } from "@/server/task-helpers";
import { removeFile } from "@/server/files";

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

async function loadTask(schoolId: string, id: string) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.task.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        targets: { include: { class: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        subject: { select: { id: true, name: true } },
        author: { select: { id: true, name: true } },
        materials: {
          select: { id: true, kind: true, text: true, fileName: true, mime: true, size: true, isMain: true, isExample: true, categoryId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        categories: { orderBy: { position: "asc" } },
      },
    }));
}

// GET /api/tasks/[id] — detail.
// SISWA: task + kategori (dengan contoh) + materi umum + mySubmission + myGroup + state.
// GURU: task + kategori + materi + stats ringkas (roster lengkap di /roster).
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
      tx.submission.findUnique({
        where: { taskId_studentId: { taskId: t.id, studentId: a.userId } },
        include: { files: true },
      }));
    const myGroup = t.isGroup
      ? await runAsSchool(db, a.school.id, (tx) =>
          tx.taskGroupMember.findFirst({
            where: { taskId: t.id, studentId: a.userId },
            include: { group: { include: { members: { include: { student: { select: { id: true, name: true } } } } } } },
          }))
      : null;

    // Kategori + contoh file (materi isExample milik kategori).
    const categories = t.categories.map((c) => ({
      ...c,
      examples: t.materials.filter((m) => m.isExample && m.categoryId === c.id),
      myFile: sub?.files.find((f) => f.categoryId === c.id) ?? null,
    }));
    const generalMaterials = t.materials.filter((m) => !m.isExample);

    return NextResponse.json({
      task: {
        id: t.id, title: t.title, instruction: t.instruction, type: t.type, status: t.status,
        deadline: t.deadline, publishAt: t.publishAt, allowLate: t.allowLate,
        isGroup: t.isGroup, groupMin: t.groupMin, groupMax: t.groupMax,
        class: t.class, subject: t.subject, author: { name: t.author.name },
      },
      materials: generalMaterials,
      categories,
      mySubmission: sub,
      myGroup: myGroup ? { id: myGroup.group.id, name: myGroup.group.name, isLeader: myGroup.group.leaderId === a.userId, members: myGroup.group.members.map((m) => ({ id: m.studentId, name: m.student.name })) } : null,
      state: submitState(t, sub?.submittedAt ?? null, now),
    });
  }

  // Guru/admin.
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const stats = await runAsSchool(db, a.school.id, (tx) => {
    const total = tx.submission.count({ where: { taskId: t.id } });
    const late = tx.submission.count({ where: { taskId: t.id, isLate: true } });
    const avg = tx.submission.aggregate({ where: { taskId: t.id, score: { not: null } }, _avg: { score: true } });
    const students = tx.studentProfile.count({ where: { classId: t.classId } });
    return Promise.all([total, late, avg, students]);
  });
  const categories = t.categories.map((c) => ({
    ...c,
    examples: t.materials.filter((m) => m.isExample && m.categoryId === c.id),
  }));
  return NextResponse.json({
    task: t,
    visible: isVisibleToStudent(t, now),
    stats: { submitted: stats[0], late: stats[1], avgScore: Math.round(stats[2]._avg.score ?? 0), totalStudents: stats[3] },
    categories,
  });
}

// PATCH /api/tasks/[id] — GURU (kelasnya/penulis) / ADMIN.
// DRAFT→PUBLISHED hanya bila lengkap (judul+instruksi terisi — schema menjamin).
// isGroup tidak boleh dimatikan bila sudah ada pengumpulan.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await loadTask(a.school.id, id.slice(0, 64));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const raw = await req.json().catch(() => null) as Record<string, unknown> | null;
  const body = taskPatchSchema.safeParse(raw);
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues.slice(0, 3) }, { status: 400 });
  // FASE 3: patch per-kelas opsional { target: { classId, deadline?, publishAt?, allowLate?, status? } }.
  const targetPatch = taskTargetPatchSchema.safeParse((raw as Record<string, unknown> | null)?.target ?? null);
  const perKelas = targetPatch.success ? targetPatch.data : null;
  if (perKelas) {
    if (a.role === "GURU") {
      const mine = await guruClassIds(a.school.id, a.userId);
      if (!mine.has(perKelas.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    }
    const row = await runAsSchool(db, a.school.id, (tx) => tx.taskTarget.upsert({
      where: { taskId_classId: { taskId: t.id, classId: perKelas.classId } },
      create: {
        schoolId: a.school.id, taskId: t.id, classId: perKelas.classId,
        ...(perKelas.status ? { status: perKelas.status } : {}),
        ...(perKelas.deadline !== undefined ? { deadline: perKelas.deadline ? new Date(perKelas.deadline) : null } : {}),
        ...(perKelas.publishAt !== undefined ? { publishAt: perKelas.publishAt ? new Date(perKelas.publishAt) : new Date() } : {}),
        ...(perKelas.allowLate !== undefined ? { allowLate: perKelas.allowLate } : {}),
      },
      update: {
        ...(perKelas.status ? { status: perKelas.status } : {}),
        ...(perKelas.deadline !== undefined ? { deadline: perKelas.deadline ? new Date(perKelas.deadline) : null } : {}),
        ...(perKelas.publishAt !== undefined ? { publishAt: perKelas.publishAt ? new Date(perKelas.publishAt) : new Date() } : {}),
        ...(perKelas.allowLate !== undefined ? { allowLate: perKelas.allowLate } : {}),
      },
    }));
    await logAuth(a.school.id, "TASK.TARGET_UPDATE", { actorId: a.userId, meta: { id: t.id, classId: perKelas.classId } });
    return NextResponse.json({ task: t, target: row });
  }

  // isGroup tidak boleh dimatikan bila sudah ada pengumpulan.
  if (body.data.isGroup === false) {
    const hasSub = await runAsSchool(db, a.school.id, (tx) => tx.submission.count({ where: { taskId: t.id } }));
    if (hasSub > 0) return NextResponse.json({ error: "sudah ada pengumpulan — tugas kelompok tidak bisa dimatikan" }, { status: 409 });
  }
  // PUBLISH bila status → PUBLISHED: notifikasi siswa.
  const willPublish = body.data.status === "PUBLISHED" && t.status !== "PUBLISHED";
  const deadlineChanged = body.data.deadline !== undefined && body.data.deadline !== (t.deadline?.toISOString() ?? null);

  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.update({
      where: { id: t.id },
      data: {
        ...(body.data.subjectId !== undefined ? { subjectId: body.data.subjectId } : {}),
        ...(body.data.title ? { title: body.data.title } : {}),
        ...(body.data.instruction ? { instruction: body.data.instruction } : {}),
        ...(body.data.type ? { type: body.data.type } : {}),
        ...(body.data.status ? { status: body.data.status } : {}),
        ...(body.data.deadline !== undefined ? { deadline: body.data.deadline ? new Date(body.data.deadline) : null } : {}),
        ...(body.data.publishAt !== undefined ? { publishAt: body.data.publishAt ? new Date(body.data.publishAt) : new Date() } : {}),
        ...(body.data.allowLate !== undefined ? { allowLate: body.data.allowLate } : {}),
        ...(body.data.isGroup !== undefined ? { isGroup: body.data.isGroup } : {}),
        ...(body.data.groupMin !== undefined ? { groupMin: body.data.groupMin } : {}),
        ...(body.data.groupMax !== undefined ? { groupMax: body.data.groupMax } : {}),
      },
    }));
  await logAuth(a.school.id, "TASK.UPDATE", { actorId: a.userId, meta: { id: t.id } });
  if (willPublish || (deadlineChanged && row.status === "PUBLISHED" && row.publishAt.getTime() <= Date.now())) {
    void notifyTaskChange(a.school.id, t.id, row.classId, willPublish ? "published" : "deadline", row.title).catch(() => {});
  }
  return NextResponse.json({ task: row });
}

// DELETE /api/tasks/[id]?scope=semua | ?scope=kelas&classId= — FASE 3 shared.
// scope=kelas: hapus penugasan kelas itu saja (induk + target lain tetap).
// scope=semua (default): hapus induk + semua target. ADMIN dan guru pengelola
// bila belum ada pengumpulan; selain itu → 409 (data nilai milik siswa).
// File materi di disk ikut dihapus (B7) hanya saat hapus induk.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "kelas" ? "kelas" : "semua";
  const scopeClassId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  const t = await loadTask(a.school.id, id.slice(0, 64));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  if (scope === "kelas") {
    if (!scopeClassId) return NextResponse.json({ error: "classId wajib untuk scope=kelas" }, { status: 400 });
    if (scopeClassId === t.classId) {
      return NextResponse.json({ error: "kelas utama tidak bisa dilepas — hapus semua bila perlu" }, { status: 400 });
    }
    if (a.role === "GURU") {
      const mine = await guruClassIds(a.school.id, a.userId);
      if (!mine.has(scopeClassId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    }
    await runAsSchool(db, a.school.id, (tx) =>
      tx.taskTarget.deleteMany({ where: { taskId: t.id, classId: scopeClassId } }));
    await logAuth(a.school.id, "TASK.TARGET_DELETE", { actorId: a.userId, meta: { id: t.id, classId: scopeClassId } });
    return NextResponse.json({ ok: true, scope: "kelas", classId: scopeClassId });
  }
  const hasSub = await runAsSchool(db, a.school.id, (tx) => tx.submission.count({ where: { taskId: t.id } }));
  if (hasSub > 0) {
    return NextResponse.json({ error: "sudah ada pengumpulan — tugas tidak bisa dihapus (arsipkan dengan menjadwalkan ulang)" }, { status: 409 });
  }
  // Hapus file di disk sebelum baris DB hilang (cascade).
  for (const m of t.materials) {
    if (m.fileName) await removeFile([a.school.id, "tasks", t.id], m.fileName);
  }
  await runAsSchool(db, a.school.id, (tx) => tx.task.delete({ where: { id: t.id } }));
  await logAuth(a.school.id, "TASK.DELETE", { actorId: a.userId, meta: { id: t.id } });
  return NextResponse.json({ ok: true });
}
