import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
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

// DELETE /api/tasks/[id]/materials/[mid] — hapus materi + file di disk (T2/B7).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, mid } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true, authorId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const m = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.findUnique({ where: { id: mid.slice(0, 64) } }));
  if (!m || m.taskId !== t.id) return NextResponse.json({ error: "materi tidak ditemukan" }, { status: 404 });
  await runAsSchool(db, a.school.id, (tx) => tx.taskMaterial.delete({ where: { id: m.id } }));
  if (m.fileName) await removeFile([a.school.id, "tasks", t.id], m.fileName);
  await logAuth(a.school.id, "TASK.MATERIAL_DELETE", { actorId: a.userId, meta: { taskId: t.id, materialId: m.id } });
  return NextResponse.json({ ok: true });
}
