import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { studentPatchSchema } from "@sms/shared/master";
import { parseBirthDate } from "@sms/shared/master";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

function scopedClassIds(a: { role: string; userId: string }, schoolId: string) {
  return (async () => {
    if (a.role !== "GURU") return null;
    const mine = await runAsSchool(db, schoolId, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }),
    );
    const homeroom = await runAsSchool(db, schoolId, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }),
    );
    return [...new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)])];
  })();
}

// GET /api/students/:id — ADMIN full; GURU hanya siswa kelasnya.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findFirst({
      where: { userId: id },
      include: {
        user: { select: { id: true, name: true, nisn: true, email: true, isActive: true } },
        class: { select: { id: true, name: true } },
      },
    }),
  );
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (a.role === "GURU") {
    const ids = await scopedClassIds(a, a.school.id);
    if (!row.classId || !ids?.includes(row.classId)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }
  return NextResponse.json({ row });
}

// PATCH /api/students/:id — ADMIN saja (edit + nonaktifkan via isActive).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = studentPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const d = body.data;
  const birthDate = d.birthDate !== undefined ? parseBirthDate(d.birthDate) : undefined;
  if (d.birthDate !== undefined && d.birthDate !== null && d.birthDate !== "" && !birthDate) {
    return NextResponse.json({ error: "tanggal lahir tidak valid" }, { status: 400 });
  }
  if (d.classId) {
    const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: d.classId! } }));
    if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  }
  try {
    await runAsSchool(
      db,
      a.school.id,
      (tx) =>
        tx.user.update({
          where: { id },
          data: {
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
            studentProfile: {
              update: {
                ...(d.classId !== undefined ? { classId: d.classId } : {}),
                ...(d.parentPhone !== undefined ? { parentPhone: d.parentPhone } : {}),
                ...(d.gender !== undefined ? { gender: d.gender } : {}),
                ...(d.birthDate !== undefined ? { birthDate } : {}),
              },
            },
          },
        }),
      { timeout: 15_000 },
    );
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "STUDENT.UPDATE", { actorId: a.userId, meta: { userId: id } });
  return NextResponse.json({ ok: true });
}
