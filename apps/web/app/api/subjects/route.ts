import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { subjectSchema } from "@sms/shared/master";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.subject.findMany({ orderBy: { name: "asc" }, take: 500 }),
  );
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = subjectSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.subject.create({ data: { schoolId: a.school.id, code: body.data.code ?? null, name: body.data.name } }),
    );
    await logAuth(a.school.id, "SUBJECT.CREATE", { actorId: a.userId, meta: { id: row.id } });
    return NextResponse.json({ row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "mapel sudah ada" }, { status: 409 });
  }
}

export async function DELETE(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const id = (new URL(req.url).searchParams.get("id") ?? "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.subject.delete({ where: { id } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "SUBJECT.DELETE", { actorId: a.userId, meta: { id } });
  return NextResponse.json({ ok: true });
}
