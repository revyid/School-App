import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";

const assignSchema = z.object({
  teacherId: z.string().min(1).max(64),
  classId: z.string().min(1).max(64),
  subject: z.string().trim().max(128).optional().nullable(),
});

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/assignments?teacherId&classId — ADMIN/GURU.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const teacherId = (url.searchParams.get("teacherId") ?? "").slice(0, 64);
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  if (a.role === "GURU" && teacherId && teacherId !== a.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.teacherClass.findMany({
      where: {
        ...(teacherId ? { teacherId } : a.role === "GURU" ? { teacherId: a.userId } : {}),
        ...(classId ? { classId } : {}),
      },
      include: {
        teacher: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { class: { name: "asc" } },
      take: 200,
    }),
  );
  return NextResponse.json({ rows });
}

// POST /api/assignments — ADMIN saja.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = assignSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findFirst({ where: { id: body.data.teacherId, role: "GURU" } }),
  );
  if (!t) return NextResponse.json({ error: "guru tidak ditemukan" }, { status: 400 });
  const c = await runAsSchool(db, a.school.id, (tx) =>
    tx.class.findUnique({ where: { id: body.data.classId } }),
  );
  if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.create({
        data: { schoolId: a.school.id, teacherId: body.data.teacherId, classId: body.data.classId, subject: body.data.subject ?? null },
      }),
    );
    await logAuth(a.school.id, "ASSIGN.CREATE", { actorId: a.userId, meta: { id: row.id } });
    return NextResponse.json({ row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "penugasan sudah ada" }, { status: 409 });
  }
}

// DELETE /api/assignments?id= — ADMIN saja.
export async function DELETE(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const id = (new URL(req.url).searchParams.get("id") ?? "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.teacherClass.delete({ where: { id } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "ASSIGN.DELETE", { actorId: a.userId, meta: { id } });
  return NextResponse.json({ ok: true });
}
