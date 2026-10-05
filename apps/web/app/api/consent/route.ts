import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { consentSchema } from "@sms/shared/leave";
import { guruClassIds } from "@/server/lms-scope";

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

// GET /api/consent?studentId= — ADMIN/GURU (guru hanya kelasnya).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const studentId = (new URL(req.url).searchParams.get("studentId") ?? "").slice(0, 64);
  if (!studentId) return NextResponse.json({ error: "studentId wajib diisi" }, { status: 400 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    const p = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } }));
    if (!p?.classId || !mine.has(p.classId)) {
      return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
    }
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.parentalConsent.findUnique({ where: { studentId } }));
  return NextResponse.json({ consent: row ?? { studentId, consented: false } });
}

// POST /api/consent {studentId, consented} — ADMIN saja (tandai manual, tercatat audit).
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = consentSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const target = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findFirst({ where: { id: body.data.studentId, role: "SISWA" }, select: { id: true } }));
  if (!target) return NextResponse.json({ error: "siswa tidak ditemukan" }, { status: 404 });
  const now = new Date();
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.parentalConsent.upsert({
      where: { studentId: target.id },
      update: { consented: body.data.consented, consentedAt: body.data.consented ? now : null, markedById: a.userId },
      create: { schoolId: a.school.id, studentId: target.id, consented: body.data.consented, consentedAt: body.data.consented ? now : null, markedById: a.userId },
    }));
  await logAuth(a.school.id, "CONSENT.MARK", {
    actorId: a.userId, meta: { studentId: target.id, consented: body.data.consented },
  });
  return NextResponse.json({ consent: row });
}
