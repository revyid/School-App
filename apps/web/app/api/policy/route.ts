import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { policySchema } from "@sms/shared/leave";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/policy — teks kebijakan privasi sekolah (semua role login).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.privacyPolicy.findUnique({ where: { schoolId: a.school.id } }));
  return NextResponse.json({ policy: row });
}

// PUT /api/policy {text} — ADMIN saja.
export async function PUT(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = policySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.privacyPolicy.upsert({
      where: { schoolId: a.school.id },
      update: { text: body.data.text },
      create: { schoolId: a.school.id, text: body.data.text },
    }));
  await logAuth(a.school.id, "POLICY.UPDATE", { actorId: a.userId, meta: {} });
  return NextResponse.json({ policy: row });
}
