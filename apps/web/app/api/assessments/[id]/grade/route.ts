import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { assessGradeSchema } from "@sms/shared/assess";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { guruClassIds } from "@/server/lms-scope";
import { logAuth } from "@/server/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const assessmentId = id.slice(0, 64);
  const body = assessGradeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input nilai tidak valid" }, { status: 400 });

  const assessment = await runAsSchool(db, auth.school.id, (tx) =>
    tx.assessment.findUnique({ where: { id: assessmentId }, select: { id: true, classId: true } }));
  if (!assessment) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (auth.role === "GURU") {
    const allowedClasses = await guruClassIds(auth.school.id, auth.userId);
    if (!allowedClasses.has(assessment.classId)) return NextResponse.json({ error: "bukan asesmen kelas Anda" }, { status: 403 });
  }

  const attempt = await runAsSchool(db, auth.school.id, (tx) =>
    tx.assessAttempt.findFirst({
      where: { id: body.data.attemptId, assessmentId },
      select: { id: true, submittedAt: true, maxScore: true },
    }));
  if (!attempt) return NextResponse.json({ error: "percobaan siswa tidak ditemukan" }, { status: 404 });
  if (!attempt.submittedAt) return NextResponse.json({ error: "siswa belum mengumpulkan asesmen" }, { status: 409 });
  if (attempt.maxScore == null || body.data.score > attempt.maxScore) {
    return NextResponse.json({ error: `Nilai harus antara 0 dan ${attempt.maxScore ?? 0}.` }, { status: 400 });
  }

  const gradedAt = new Date();
  const updated = await runAsSchool(db, auth.school.id, (tx) =>
    tx.assessAttempt.update({
      where: { id: attempt.id },
      data: { score: body.data.score, feedback: body.data.feedback ?? null, gradedById: auth.userId, gradedAt },
      select: { id: true, score: true, maxScore: true, feedback: true, gradedAt: true },
    }));
  await logAuth(auth.school.id, "ASSESS.GRADE", {
    actorId: auth.userId,
    meta: { assessmentId, attemptId: attempt.id, score: body.data.score },
  });
  return NextResponse.json({ attempt: updated });
}
