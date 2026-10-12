import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const memberSchema = z.object({ studentId: z.string().min(1).max(64) });

// POST /api/tasks/[id]/groups/[gid]/members {studentId} — tambah anggota.
// Aturan: satu siswa = satu grup per tugas (pindah = hapus dari grup lama dulu via DELETE).
export async function POST(
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
  const g = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findFirst({ where: { id: gid.slice(0, 64), taskId: t.id }, select: { id: true } }));
  if (!g) return NextResponse.json({ error: "grup tidak ditemukan" }, { status: 404 });
  const body = memberSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "studentId wajib ada" }, { status: 400 });
  // Siswa harus sekelas.
  const prof = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: body.data.studentId }, select: { classId: true } }));
  if (!prof || prof.classId !== t.classId) {
    return NextResponse.json({ error: "siswa bukan anggota kelas ini" }, { status: 400 });
  }
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroupMember.create({
        data: { schoolId: a.school.id, groupId: g.id, taskId: t.id, studentId: body.data.studentId },
      }));
    await logAuth(a.school.id, "TASK.GROUP_MEMBER_ADD", { actorId: a.userId, meta: { taskId: t.id, groupId: g.id } });
    return NextResponse.json({ member: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "siswa sudah punya grup di tugas ini" }, { status: 409 });
  }
}

// DELETE /api/tasks/[id]/groups/[gid]/members?studentId= — keluarkan anggota.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, gid } = await params;
  const studentId = new URL(req.url).searchParams.get("studentId")?.slice(0, 64) ?? "";
  if (!studentId) return NextResponse.json({ error: "studentId wajib ada" }, { status: 400 });
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.deleteMany({ where: { groupId: gid.slice(0, 64), taskId: t.id, studentId } }));
  await logAuth(a.school.id, "TASK.GROUP_MEMBER_DEL", { actorId: a.userId, meta: { taskId: t.id } });
  return NextResponse.json({ ok: true });
}
