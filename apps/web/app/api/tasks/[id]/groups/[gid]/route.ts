import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { guruClassIds } from "@/server/lms-scope";

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

// DELETE /api/tasks/[id]/groups/[gid] — hapus grup beserta anggotanya.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, gid } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.deleteMany({ where: { id: gid.slice(0, 64), taskId: t.id } }));
  await logAuth(a.school.id, "TASK.GROUP_DELETE", { actorId: a.userId, meta: { taskId: t.id } });
  return NextResponse.json({ ok: true });
}
