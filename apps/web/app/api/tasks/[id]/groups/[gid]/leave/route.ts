import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { siswaClassId } from "@/server/lms-scope";
import { groupLockState } from "@/server/task-helpers";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SISWA"],
  });
}

// POST /api/tasks/[id]/groups/[gid]/leave — T6/D2: anggota keluar dari kelompok.
// Terkunci bila deadline lewat ATAU kelompok sudah mengumpulkan.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, gid } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, isGroup: true, deadline: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!t.isGroup) return NextResponse.json({ error: "bukan tugas kelompok" }, { status: 400 });
  const cid = await siswaClassId(a.school.id, a.userId);
  if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });

  const g = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findFirst({
      where: { id: gid.slice(0, 64), taskId: t.id },
      include: { members: { select: { studentId: true } } },
    }));
  if (!g) return NextResponse.json({ error: "kelompok tidak ditemukan" }, { status: 404 });
  if (!g.members.some((m) => m.studentId === a.userId)) {
    return NextResponse.json({ error: "kamu bukan anggota kelompok ini" }, { status: 403 });
  }
  if (g.leaderId === a.userId) {
    return NextResponse.json({ error: "ketua tidak bisa keluar — hapus kelompok, atau minta guru memindahkan" }, { status: 400 });
  }
  const lock = await groupLockState(a.school.id, t.id, t.deadline);
  if (lock.locked) return NextResponse.json({ error: `kelompok terkunci: ${lock.reason}` }, { status: 409 });

  await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.deleteMany({ where: { groupId: g.id, studentId: a.userId } }));
  await logAuth(a.school.id, "TASK.GROUP_LEAVE", { actorId: a.userId, meta: { taskId: t.id, groupId: g.id } });
  return NextResponse.json({ ok: true });
}
