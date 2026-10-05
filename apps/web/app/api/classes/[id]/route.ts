import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { classSchema } from "@sms/shared/master";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = classSchema.partial().safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  if (body.data.homeroomTeacherId) {
    const t = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findFirst({ where: { id: body.data.homeroomTeacherId!, role: "GURU" } }),
    );
    if (!t) return NextResponse.json({ error: "wali kelas harus guru sekolah ini" }, { status: 400 });
  }
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.update({
        where: { id },
        data: {
          ...(body.data.name !== undefined ? { name: body.data.name } : {}),
          ...(body.data.gradeLevel !== undefined ? { gradeLevel: body.data.gradeLevel } : {}),
          ...(body.data.homeroomTeacherId !== undefined ? { homeroomTeacherId: body.data.homeroomTeacherId } : {}),
        },
      }),
    );
    await logAuth(a.school.id, "CLASS.UPDATE", { actorId: a.userId, meta: { classId: id } });
    return NextResponse.json({ row });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const used = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.count({ where: { classId: id } }),
  );
  if (used > 0) return NextResponse.json({ error: "kelas masih memiliki siswa" }, { status: 409 });
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.class.delete({ where: { id } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "CLASS.DELETE", { actorId: a.userId, meta: { classId: id } });
  return NextResponse.json({ ok: true });
}
