import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import {
  answerSubmitSchema, seedFrom, toClientQuestions, gradeAttempt,
  type QRow,
} from "@sms/shared/assess";
import { awardExp } from "@/server/exp";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
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

async function loadAssessment(schoolId: string, id: string) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.assessment.findUnique({
      where: { id: id.slice(0, 64) },
      include: { questions: { orderBy: { position: "asc" } } },
    }));
}

// GET /api/assessments/[id]/attempt — mulai/ambil attempt siswa.
// SISWA: hanya kelasnya + publishAt lewat. Kunci TIDAK ikut. Urutan acak disimpan di attempt.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await loadAssessment(a.school.id, id);
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (as.publishAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "belum dipublikasi" }, { status: 403 });
  }
  const prof = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
  if (!prof?.classId || prof.classId !== as.classId) {
    return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
  }
  if (as.deadline && as.deadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "deadline lewat" }, { status: 410 });
  }

  const qs: QRow[] = as.questions.map((q) => ({
    id: q.id, type: q.type, stem: q.stem, imageName: q.imageName, options: q.options,
    correctIndex: q.correctIndex, correctOrder: q.correctOrder, points: q.points,
  }));
  const seed = seedFrom(a.school.id, as.id, a.userId);
  // Attempt idempoten: satu baris per (assessment, student).
  const attempt = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.upsert({
      where: { assessmentId_studentId: { assessmentId: as.id, studentId: a.userId } },
      update: {},
      create: { schoolId: a.school.id, assessmentId: as.id, studentId: a.userId },
    }));
  let qOrder: string[] = attempt.qOrder;
  let optOrders: Record<string, number[]> = (attempt.optOrders as Record<string, number[]> | null) ?? {};
  let clientQs;
  if (qOrder.length === 0) {
    const t = toClientQuestions(qs, { shuffleQ: as.shuffleQ, shuffleOpt: as.shuffleOpt, seed });
    qOrder = t.qOrder;
    optOrders = t.optOrders;
    clientQs = t.clientQs;
    await runAsSchool(db, a.school.id, (tx) =>
      tx.assessAttempt.update({
        where: { id: attempt.id },
        data: { qOrder, optOrders: JSON.parse(JSON.stringify(optOrders)) },
      }));
  } else {
    // Rekonstruksi tampilan yang sama dari order tersimpan (anti curang ganti urutan).
    const byId = new Map(qs.map((q) => [q.id, q]));
    clientQs = qOrder
      .map((qid) => byId.get(qid))
      .filter((q): q is QRow => !!q)
      .map((q) => {
        const order = optOrders[q.id] ?? q.options.map((_, i) => i);
        return {
          id: q.id, type: q.type, stem: q.stem,
          imageUrl: q.imageName ? `/api/assess-files/${q.id}/${q.imageName}` : null,
          options: order.map((i) => q.options[i]),
        };
      });
  }
  return NextResponse.json({
    attempt: { id: attempt.id, submittedAt: attempt.submittedAt, score: attempt.submittedAt ? attempt.score : undefined },
    assessment: { id: as.id, title: as.title, instruction: as.instruction, durationMin: as.durationMin, deadline: as.deadline, kind: as.kind },
    questions: attempt.submittedAt ? [] : clientQs,
  });
}

// POST /api/assessments/[id]/attempt {answers} — kumpulkan; dinilai server-side langsung.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:assess-submit:${a.school.id}:${a.userId}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const { id } = await params;
  const body = answerSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "jawaban tidak valid" }, { status: 400 });

  const as = await loadAssessment(a.school.id, id);
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  const prof = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
  if (!prof?.classId || prof.classId !== as.classId) {
    return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
  }
  if (as.deadline && as.deadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "deadline lewat" }, { status: 410 });
  }
  const attempt = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.findUnique({
      where: { assessmentId_studentId: { assessmentId: as.id, studentId: a.userId } },
    }));
  if (!attempt || attempt.qOrder.length === 0) {
    return NextResponse.json({ error: "mulai attempt dulu via GET" }, { status: 400 });
  }
  if (attempt.submittedAt) {
    return NextResponse.json({ error: "sudah dikumpulkan", score: attempt.score }, { status: 409 });
  }
  const qs: QRow[] = as.questions.map((q) => ({
    id: q.id, type: q.type, stem: q.stem, imageName: q.imageName, options: q.options,
    correctIndex: q.correctIndex, correctOrder: q.correctOrder, points: q.points,
  }));
  const optOrders = (attempt.optOrders as Record<string, number[]> | null) ?? {};
  const { perQ, score, maxScore } = gradeAttempt(qs, optOrders, body.data.answers);
  const now = new Date();
  await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: now, score, maxScore },
    }));
  for (const p of perQ) {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.assessAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId: p.questionId } },
        update: { pickedIndex: p.pickedIndex, pickedOrder: p.pickedOrder, isCorrect: p.isCorrect, points: p.points },
        create: {
          schoolId: a.school.id, attemptId: attempt.id, questionId: p.questionId,
          pickedIndex: p.pickedIndex, pickedOrder: p.pickedOrder, isCorrect: p.isCorrect, points: p.points,
        },
      }));
  }
  await logAuth(a.school.id, "ASSESS.SUBMIT", { actorId: a.userId, meta: { id: as.id, score } });
  // EXP: nilai penuh / tepat waktu -> catat via outbox-less langsung (idempoten dedupeKey).
  const onTime = !as.deadline || now.getTime() <= as.deadline.getTime();
  await awardExp(a.school.id, a.userId, onTime ? "submitTepat" : "submitTerlambat", `assess-${attempt.id}`).catch(() => {});
  return NextResponse.json({ score, maxScore });
}
