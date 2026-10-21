import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { categoryInputSchema } from "@lacakedu/shared/lms";
import { canManageTask } from "@/server/task-helpers";
import { removeFile } from "@/server/files";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// PATCH /api/tasks/[id]/categories/[cid] — ubah kategori.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, cid } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true, authorId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const body = categoryInputSchema.partial().safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskCategory.update({
      where: { id: cid.slice(0, 64) },
      data: {
        ...(body.data.name ? { name: body.data.name } : {}),
        ...(body.data.instruction !== undefined ? { instruction: body.data.instruction ?? null } : {}),
        ...(body.data.required !== undefined ? { required: body.data.required } : {}),
        ...(body.data.accept ? { accept: body.data.accept } : {}),
        ...(body.data.position !== undefined ? { position: body.data.position } : {}),
      },
    }));
  await logAuth(a.school.id, "TASK.CATEGORY_UPDATE", { actorId: a.userId, meta: { taskId: t.id, categoryId: cid } });
  return NextResponse.json({ category: row });
}

// DELETE /api/tasks/[id]/categories/[cid]?force=1 — hapus kategori.
// Bila sudah ada file siswa di kategori ini → 409, kecuali ?force=1 (file ikut dihapus).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, cid } = await params;
  const force = new URL(req.url).searchParams.get("force") === "1";
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true, authorId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const existing = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskCategory.findUnique({ where: { id: cid.slice(0, 64) } }));
  if (!existing || existing.taskId !== t.id) {
    return NextResponse.json({ error: "kategori tidak ditemukan" }, { status: 404 });
  }
  const files = await runAsSchool(db, a.school.id, (tx) =>
    tx.submissionFile.findMany({
      where: { categoryId: existing.id },
      select: { id: true, fileName: true, submissionId: true },
    }));
  if (files.length > 0 && !force) {
    return NextResponse.json({ error: "kategori sudah berisi file siswa — hapus paksa dengan ?force=1" }, { status: 409 });
  }
  // Hapus file fisik + baris (submissionFile.categoryId jadi NULL oleh SetNull;
  // force → hapus baris file juga).
  for (const f of files) {
    const sub = await runAsSchool(db, a.school.id, (tx) =>
      tx.submission.findUnique({ where: { id: f.submissionId }, select: { taskId: true } }));
    if (sub) await removeFile([a.school.id, "tasks", sub.taskId], f.fileName);
    if (force) await runAsSchool(db, a.school.id, (tx) => tx.submissionFile.delete({ where: { id: f.id } }));
  }
  await runAsSchool(db, a.school.id, (tx) => tx.taskCategory.delete({ where: { id: existing.id } }));
  await logAuth(a.school.id, "TASK.CATEGORY_DELETE", { actorId: a.userId, meta: { taskId: t.id, categoryId: existing.id, force } });
  return NextResponse.json({ ok: true });
}
