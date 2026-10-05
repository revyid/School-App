import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { itemAnalysis, type QRow } from "@sms/shared/assess";

// GET /api/assessments/[id]/analysis — GURU (miliknya)/ADMIN: kesulitan + distraktor.
// Kunci jawaban TIDAK dikirim (hanya stem + statistik).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({
      where: { id: id.slice(0, 64) },
      include: { questions: { orderBy: { position: "asc" } } },
    }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  const answers = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAnswer.findMany({
      where: { attempt: { assessmentId: as.id, submittedAt: { not: null } } },
      select: { questionId: true, pickedIndex: true, pickedOrder: true, isCorrect: true },
      take: 5000,
    }));
  const qs: QRow[] = as.questions.map((q) => ({
    id: q.id, type: q.type, stem: q.stem.slice(0, 120), imageName: null, options: q.options,
    correctIndex: null, correctOrder: [], points: q.points,
  }));
  const items = itemAnalysis(qs, answers.map((r) => ({
    questionId: r.questionId, pickedIndex: r.pickedIndex, pickedOrder: r.pickedOrder, isCorrect: r.isCorrect,
  })));
  const done = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.count({ where: { assessmentId: as.id, submittedAt: { not: null } } }));
  return NextResponse.json({
    items: items.map((it, i) => ({ ...it, stem: as.questions[i]?.stem.slice(0, 120) ?? "" })),
    attempts: done,
  });
}
