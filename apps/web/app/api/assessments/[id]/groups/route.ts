import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { groupInputSchema } from "@sms/shared/assess";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
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

// GET /api/assessments/[id]/groups — daftar grup + anggota.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, authorId: true } }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  const groups = await runAsSchool(db, a.school.id, (tx) =>
    tx.studyGroup.findMany({
      where: { assessmentId: as.id },
      include: { members: { include: { student: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
      take: 100,
    }));
  return NextResponse.json({ groups });
}

// POST /api/assessments/[id]/groups {name, studentIds} — buat grup.
// Aturan: satu siswa = satu grup per asesmen (unique assessmentId+studentId menolak ganda).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = groupInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, authorId: true, classId: true } }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  // Semua studentIds harus siswa kelas asesmen.
  const profiles = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { userId: { in: body.data.studentIds }, classId: as.classId },
      select: { userId: true },
      take: 60,
    }));
  if (profiles.length !== body.data.studentIds.length) {
    return NextResponse.json({ error: "sebagian siswa bukan kelas asesmen ini" }, { status: 400 });
  }
  const g = await runAsSchool(db, a.school.id, (tx) =>
    tx.studyGroup.create({
      data: { schoolId: a.school.id, assessmentId: as.id, name: body.data.name },
    })).catch(() => null);
  if (!g) return NextResponse.json({ error: "nama grup sudah dipakai" }, { status: 409 });
  // Tambah anggota satu per satu agar pelanggar unique langsung ketahuan.
  const failed: string[] = [];
  for (const sid of body.data.studentIds) {
    const ok = await runAsSchool(db, a.school.id, (tx) =>
      tx.studyGroupMember.create({
        data: { schoolId: a.school.id, groupId: g.id, studentId: sid, assessmentId: as.id },
      })).catch(() => null);
    if (!ok) failed.push(sid);
  }
  await logAuth(a.school.id, "ASSESS.GROUP", { actorId: a.userId, meta: { id: as.id, name: body.data.name } });
  if (failed.length > 0) {
    return NextResponse.json({
      group: g, warning: "sebagian siswa sudah punya grup di asesmen ini (satu siswa = satu grup)",
      failed,
    }, { status: 201 });
  }
  return NextResponse.json({ group: g }, { status: 201 });
}
