import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { teacherPatchSchema } from "@sms/shared/master";

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
  const body = teacherPatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.update({
        where: { id },
        data: {
          ...(body.data.name !== undefined ? { name: body.data.name } : {}),
          ...(body.data.email !== undefined ? { email: body.data.email.toLowerCase() } : {}),
          ...(body.data.isActive !== undefined ? { isActive: body.data.isActive } : {}),
        },
        select: { id: true, name: true, email: true, isActive: true, role: true },
      }),
    );
    if (row.role !== "GURU") return NextResponse.json({ error: "bukan guru" }, { status: 400 });
    await logAuth(a.school.id, "TEACHER.UPDATE", { actorId: a.userId, meta: { userId: id } });
    return NextResponse.json({ row });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// POST /api/teachers/:id/reset-password — ADMIN: password acak baru, mustChangePassword.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const target = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({ where: { id }, select: { id: true, role: true } }),
  );
  if (!target || target.role !== "GURU") return NextResponse.json({ error: "guru tidak ditemukan" }, { status: 404 });
  const pw = randomBytes(9).toString("base64url");
  const hash = await argon2.hash(pw, { type: argon2.argon2id });
  await runAsSchool(db, a.school.id, (tx) =>
    tx.user.update({
      where: { id },
      data: { passwordHash: hash, passwordChangedAt: new Date(), mustChangePassword: true },
    }),
  );
  await logAuth(a.school.id, "TEACHER.PASSWORD_RESET", { actorId: a.userId, meta: { userId: id } });
  return NextResponse.json({ tempPassword: pw });
}
