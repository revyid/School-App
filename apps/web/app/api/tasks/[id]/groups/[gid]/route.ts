import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { guruClassIds, siswaClassId } from "@/server/lms-scope";
import { groupPatchSchema } from "@sms/shared/lms";
import { groupLockState } from "@/server/task-helpers";
import { notifyUser } from "@/server/notify";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
}

// PATCH /api/tasks/[id]/groups/[gid] — T6.
// SISWA (ketua): ganti nama, tambah/keluarkan anggota (D2: batas max, sekelas, belum bergrup, tidak terkunci).
// GURU/ADMIN: bebas (boleh kapan pun, D2).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, gid } = await params;
  const body = groupPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, isGroup: true, groupMin: true, groupMax: true, deadline: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });

  const g = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findFirst({
      where: { id: gid.slice(0, 64), taskId: t.id },
      include: { members: { select: { studentId: true } } },
    }));
  if (!g) return NextResponse.json({ error: "kelompok tidak ditemukan" }, { status: 404 });

  if (a.role === "SISWA") {
    if (!t.isGroup) return NextResponse.json({ error: "bukan tugas kelompok" }, { status: 400 });
    const cid = await siswaClassId(a.school.id, a.userId);
    if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (g.leaderId !== a.userId) {
      return NextResponse.json({ error: "hanya ketua kelompok yang boleh mengubah" }, { status: 403 });
    }
    const lock = await groupLockState(a.school.id, t.id, t.deadline);
    if (lock.locked) return NextResponse.json({ error: `kelompok terkunci: ${lock.reason}` }, { status: 409 });
  }

  const current = new Set(g.members.map((m) => m.studentId));
  const add = body.data.addMemberIds ?? [];
  const remove = body.data.removeMemberIds ?? [];

  // Validasi tambah: sekelas + belum bergrup + batas max + tidak mengeluarkan leader.
  if (add.length) {
    const profiles = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findMany({
        where: { classId: t.classId, user: { id: { in: add } } },
        select: { userId: true },
      }));
    const inClass = new Set(profiles.map((p) => p.userId));
    const taken = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroupMember.findMany({ where: { taskId: t.id, studentId: { in: add }, NOT: { groupId: g.id } }, select: { studentId: true } }));
    const takenSet = new Set(taken.map((x) => x.studentId));
    for (const sid of add) {
      if (!inClass.has(sid)) return NextResponse.json({ error: "ada calon anggota yang bukan sekelas" }, { status: 400 });
      if (takenSet.has(sid)) return NextResponse.json({ error: "ada calon anggota yang sudah berkelompok" }, { status: 400 });
    }
    const newSize = current.size - remove.filter((r) => current.has(r)).length + add.filter((x) => !current.has(x)).length;
    if (newSize > t.groupMax) return NextResponse.json({ error: `maksimal ${t.groupMax} anggota` }, { status: 400 });
  }

  // Keluarkan leader lewat removeMemberIds = tolak (leader harus transfer/hapus grup).
  if (remove.includes(g.leaderId)) {
    return NextResponse.json({ error: "ketua tidak bisa dikeluarkan — keluar via fitur keluar/hapus kelompok" }, { status: 400 });
  }

  try {
    const row = await runAsSchool(db, a.school.id, async (tx) => {
      if (body.data.name) {
        await tx.taskGroup.update({ where: { id: g.id }, data: { name: body.data.name } });
      }
      if (remove.length) {
        await tx.taskGroupMember.deleteMany({ where: { groupId: g.id, studentId: { in: remove } } });
      }
      if (add.length) {
        await tx.taskGroupMember.createMany({
          data: add.filter((x) => !current.has(x)).map((sid) => ({
            schoolId: a.school.id, groupId: g.id, taskId: t.id, studentId: sid,
          })),
        });
      }
      return tx.taskGroup.findUnique({ where: { id: g.id }, include: { members: true } });
    });
    // Notifikasi ke anggota baru.
    const actor = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findUnique({ where: { id: a.userId }, select: { name: true } }));
    for (const sid of add) {
      await notifyUser(a.school.id, sid, "Kamu masuk kelompok", `Kamu dimasukkan ke "${row?.name ?? g.name}" oleh ${actor?.name ?? "ketua"}.`, {
        href: `/siswa/tugas/${t.id}`,
        kind: "task-group",
      }).catch(() => {});
    }
    await logAuth(a.school.id, "TASK.GROUP_UPDATE", { actorId: a.userId, meta: { taskId: t.id, groupId: g.id } });
    return NextResponse.json({ group: row });
  } catch {
    return NextResponse.json({ error: "nama kelompok sudah dipakai" }, { status: 409 });
  }
}

// DELETE /api/tasks/[id]/groups/[gid] — hapus kelompok.
// SISWA: hanya ketua + belum ada pengumpulan. GURU/ADMIN: bebas (D2).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; gid: string }> },
) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id, gid } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, isGroup: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });

  const g = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findFirst({ where: { id: gid.slice(0, 64), taskId: t.id }, select: { id: true, leaderId: true } }));
  if (!g) return NextResponse.json({ error: "kelompok tidak ditemukan" }, { status: 404 });

  if (a.role === "SISWA") {
    if (!t.isGroup) return NextResponse.json({ error: "bukan tugas kelompok" }, { status: 400 });
    const cid = await siswaClassId(a.school.id, a.userId);
    if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (g.leaderId !== a.userId) return NextResponse.json({ error: "hanya ketua yang boleh menghapus kelompok" }, { status: 403 });
    const lock = await groupLockState(a.school.id, t.id, null);
    if (lock.locked) return NextResponse.json({ error: `kelompok terkunci: ${lock.reason}` }, { status: 409 });
  } else if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }

  await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.deleteMany({ where: { id: g.id, taskId: t.id } }));
  await logAuth(a.school.id, "TASK.GROUP_DELETE", { actorId: a.userId, meta: { taskId: t.id, groupId: g.id } });
  return NextResponse.json({ ok: true });
}
