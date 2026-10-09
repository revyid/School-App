import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { resolveDefaultPassword } from "@/server/password";

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

// POST /api/students/:id/reset-password — ADMIN: reset password siswa ke mode default/acak.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const target = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({ where: { id }, select: { id: true, role: true, nisn: true } }),
  );
  if (!target || target.role !== "SISWA") {
    return NextResponse.json({ error: "siswa tidak ditemukan" }, { status: 404 });
  }
  const { password: pw, mode } = await resolveDefaultPassword(a.school.id, target.nisn);
  const hash = await argon2.hash(pw, { type: argon2.argon2id });
  await runAsSchool(db, a.school.id, (tx) =>
    tx.user.update({
      where: { id },
      data: { passwordHash: hash, passwordChangedAt: new Date(), mustChangePassword: mode === "random" },
    }),
  );
  await logAuth(a.school.id, "STUDENT.PASSWORD_RESET", { actorId: a.userId, meta: { userId: id } });
  return NextResponse.json({ tempPassword: pw });
}
