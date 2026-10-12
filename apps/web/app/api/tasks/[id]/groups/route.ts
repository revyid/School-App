import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { guruClassIds } from "@/server/lms-scope";

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
    tx.task.findUnique({ where: { id: taskId }, select: { id: true, classId: true } }));
  if (!t) return null;
  if (role === "GURU") {
    const mine = await guruClassIds(schoolId, userId);
    if (!mine.has(t.classId)) return null;
  }
  return t;
}

// GET /api/tasks/[id]/groups — daftar grup + anggota (guru/admin; siswa hanya grupnya).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await checkTask(a.school.id, id.slice(0, 64), a.userId, a.role);
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const groups = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroup.findMany({
      where: { taskId: t.id },
      include: { members: { include: { student: { select: { id: true, name: true, nisn: true } } } } },
      orderBy: { name: "asc" },
      take: 100,
    }));
  if (a.role === "SISWA") {
    const mine = groups.filter((g) => g.members.some((m) => m.studentId === a.userId));
    return NextResponse.json({ rows: mine });
  }
  // Siswa tanpa grup (untuk picker tambah anggota).
  const roster = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId },
      include: { user: { select: { id: true, name: true, nisn: true } } },
      take: 500,
    }));
  const taken = new Set<string>();
  for (const g of groups) for (const m of g.members) taken.add(m.studentId);
  return NextResponse.json({
    rows: groups,
    ungrouped: roster.map((r) => r.user).filter((u) => !taken.has(u.id)),
  });
}

const createSchema = z.object({ name: z.string().trim().min(1).max(100) });

// POST /api/tasks/[id]/groups {name} — GURU/ADMIN buat grup.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await checkTask(a.school.id, id.slice(0, 64), a.userId, a.role);
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const body = createSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "nama grup wajib ada" }, { status: 400 });
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroup.create({
        data: { schoolId: a.school.id, taskId: t.id, name: body.data.name },
      }));
    await logAuth(a.school.id, "TASK.GROUP_CREATE", { actorId: a.userId, meta: { taskId: t.id, groupId: row.id } });
    return NextResponse.json({ group: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "nama grup sudah dipakai" }, { status: 409 });
  }
}
