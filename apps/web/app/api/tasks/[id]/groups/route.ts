import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { guruClassIds, siswaClassId } from "@/server/lms-scope";
import { groupCreateSchema } from "@sms/shared/lms";
import { notifyUser } from "@/server/notify";
import { groupLockState } from "@/server/task-helpers";

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

async function checkTask(schoolId: string, taskId: string, userId: string, role: string) {
  const t = await runAsSchool(db, schoolId, (tx) =>
    tx.task.findUnique({
      where: { id: taskId },
      select: { id: true, classId: true, isGroup: true, groupMin: true, groupMax: true, deadline: true, authorId: true },
    }));
  if (!t) return null;
  if (role === "GURU") {
    const mine = await guruClassIds(schoolId, userId);
    if (!mine.has(t.classId)) return null;
  }
  return t;
}

// GET /api/tasks/[id]/groups — T6.
// GURU/ADMIN: semua grup + siswa belum bergrup.
// SISWA: {rules, groups (semua, ringkas), classmates (belum bergrup)} — tanpa NISN/telepon.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await checkTask(a.school.id, id.slice(0, 64), a.userId, a.role);
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });

  // Siswa hanya untuk tugas kelompok kelasnya yang visible.
  if (a.role === "SISWA") {
    if (!t.isGroup) return NextResponse.json({ error: "bukan tugas kelompok" }, { status: 404 });
    const cid = await siswaClassId(a.school.id, a.userId);
    if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    const lock = await groupLockState(a.school.id, t.id, t.deadline);
    const groups = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroup.findMany({
        where: { taskId: t.id },
        include: { members: { select: { studentId: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      }));
    const memberships = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroupMember.findMany({ where: { taskId: t.id }, select: { studentId: true, groupId: true } }));
    const grouped = new Set(memberships.map((m) => m.studentId));
    const names = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findMany({
        where: { classId: t.classId },
        include: { user: { select: { id: true, name: true } } },
        take: 500,
      }));
    return NextResponse.json({
      rules: { min: t.groupMin, max: t.groupMax, locked: lock.locked, reason: lock.reason },
      groups: groups.map((g) => ({
        id: g.id, name: g.name,
        members: g.members.map((m) => m.studentId),
        size: g.members.length,
        full: g.members.length >= t.groupMax,
        isMine: g.members.some((m) => m.studentId === a.userId),
      })),
      classmates: names
        .filter((r) => !grouped.has(r.user.id) && r.user.id !== a.userId)
        .map((r) => ({ id: r.user.id, name: r.user.name, groupId: null })),
    });
  }

  // Guru/admin.
  const groups = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findMany({
      where: { taskId: t.id },
      include: { members: { include: { student: { select: { id: true, name: true, nisn: true } } } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }));
  const lock = await groupLockState(a.school.id, t.id, t.deadline);
  const memberships = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.findMany({ where: { taskId: t.id }, select: { studentId: true, groupId: true } }));
  const membershipByStudent = new Map(memberships.map((m) => [m.studentId, m.groupId]));
  const roster = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId },
      include: { user: { select: { id: true, name: true, nisn: true } } },
      take: 500,
    }));
  const taken = new Set<string>([...membershipByStudent.keys()]);
  return NextResponse.json({
    rules: { min: t.groupMin, max: t.groupMax, locked: lock.locked, reason: lock.reason },
    rows: groups,
    ungrouped: roster
      .map((r) => ({ ...r.user, groupId: membershipByStudent.get(r.user.id) ?? null }))
      .filter((u) => !taken.has(u.id)),
  });
}

// POST /api/tasks/[id]/groups — T6/D2.
// SISWA: {name?, memberIds[]} — pembuat jadi ketua + anggota; anggota dari kelas yang sama
// yang belum bergrup; ukuran ≤ max; tidak terkunci.
// GURU/ADMIN: {name} — buat grup kosong.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const rl = await hit(`rl:group:${a.school.id}:${a.userId}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const t = await checkTask(a.school.id, id.slice(0, 64), a.userId, a.role);
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const body = groupCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  if (a.role === "GURU" || a.role === "ADMIN") {
    if (!body.data.name) return NextResponse.json({ error: "nama kelompok wajib" }, { status: 400 });
    try {
      const row = await runAsSchool(db, a.school.id, (tx) =>
        tx.taskGroup.create({
          data: { schoolId: a.school.id, taskId: t.id, name: body.data.name!, createdById: a.userId, leaderId: a.userId },
        }));
      await logAuth(a.school.id, "TASK.GROUP_CREATE", { actorId: a.userId, meta: { taskId: t.id, groupId: row.id } });
      return NextResponse.json({ group: row }, { status: 201 });
    } catch {
      return NextResponse.json({ error: "nama kelompok sudah dipakai" }, { status: 409 });
    }
  }

  // ---- Siswa ----
  if (!t.isGroup) return NextResponse.json({ error: "bukan tugas kelompok" }, { status: 400 });
  const cid = await siswaClassId(a.school.id, a.userId);
  if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  const lock = await groupLockState(a.school.id, t.id, t.deadline);
  if (lock.locked) return NextResponse.json({ error: `kelompok terkunci: ${lock.reason}` }, { status: 409 });

  // Belum punya kelompok.
  const mine = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.findFirst({ where: { taskId: t.id, studentId: a.userId } }));
  if (mine) return NextResponse.json({ error: "kamu sudah punya kelompok untuk tugas ini" }, { status: 409 });

  const memberIds = [...new Set(body.data.memberIds)].filter((x) => x !== a.userId);
  if (memberIds.length + 1 > t.groupMax) {
    return NextResponse.json({ error: `maksimal ${t.groupMax} anggota (termasuk kamu)` }, { status: 400 });
  }

  // Validasi anggota: sekelas + belum punya grup.
  const profiles = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId, user: { id: { in: memberIds } } },
      select: { userId: true },
    }));
  const inClass = new Set(profiles.map((p) => p.userId));
  const already = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.findMany({ where: { taskId: t.id, studentId: { in: memberIds } }, select: { studentId: true } }));
  const taken = new Set(already.map((x) => x.studentId));
  const invalid = memberIds.filter((x) => !inClass.has(x) || taken.has(x));
  if (invalid.length) return NextResponse.json({ error: "ada anggota yang bukan sekelas atau sudah berkelompok" }, { status: 400 });

  const name = body.data.name?.trim() || `Kelompok ${new Date().getTime().toString(36).slice(-4)}`;
  try {
    const row = await runAsSchool(db, a.school.id, async (tx) => {
      const g = await tx.taskGroup.create({
        data: { schoolId: a.school.id, taskId: t.id, name, createdById: a.userId, leaderId: a.userId },
      });
      await tx.taskGroupMember.createMany({
        data: [
          { schoolId: a.school.id, groupId: g.id, taskId: t.id, studentId: a.userId },
          ...memberIds.map((sid) => ({ schoolId: a.school.id, groupId: g.id, taskId: t.id, studentId: sid })),
        ],
      });
      return g;
    });
    // Notifikasi in-app ke anggota yang ditambahkan ("Kamu masuk Kelompok X oleh Y").
    const actor = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findUnique({ where: { id: a.userId }, select: { name: true } }));
    for (const sid of memberIds) {
      await notifyUser(a.school.id, sid, "Kamu masuk kelompok", `Kamu dimasukkan ke "${name}" oleh ${actor?.name ?? "ketua kelompok"}.`, {
        href: `/siswa/tugas/${t.id}`,
        kind: "task-group",
      }).catch(() => {});
    }
    await logAuth(a.school.id, "TASK.GROUP_CREATE", { actorId: a.userId, meta: { taskId: t.id, groupId: row.id, by: "SISWA" } });
    return NextResponse.json({ group: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "nama kelompok sudah dipakai" }, { status: 409 });
  }
}
