import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/assessments/[id]/result — SISWA: review read-only milik sendiri setelah mengumpulkan.
// Opsi ditampilkan TANPA label A/B/C; jawaban benar ditandai server (isCorrect + correctIndex).
// Chart kelas (persentase benar per soal) hanya ikut bila assessment.showChart true.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({
      where: { id: id.slice(0, 64) },
      include: { questions: { orderBy: { position: "asc" } } },
    }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  const attempt = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.findUnique({
      where: { assessmentId_studentId: { assessmentId: as.id, studentId: a.userId } },
    }));
  if (!attempt) return NextResponse.json({ error: "belum mengerjakan" }, { status: 404 });
  if (!attempt.submittedAt) return NextResponse.json({ submitted: false });
  const answers = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAnswer.findMany({
      where: { attemptId: attempt.id },
      select: { questionId: true, pickedIndex: true, pickedOrder: true, isCorrect: true, points: true },
    }));
  const ansByQ = new Map(answers.map((r) => [r.questionId, r]));
  const questions = as.questions.map((q) => {
    const an = ansByQ.get(q.id);
    if (q.type === "SORTING") {
      const correctSeq = q.correctOrder.map((i) => q.options[i] ?? "");
      const pickedSeq = (an?.pickedOrder ?? []).map((i) => q.options[i] ?? "");
      return {
        id: q.id, type: q.type, stem: q.stem,
        imageUrl: q.imageName ? `/api/assess-files/${q.id}/${q.imageName}` : null,
        correctSeq, pickedSeq, isCorrect: an?.isCorrect ?? false,
        points: an?.points ?? 0, maxPoints: q.points,
      };
    }
    return {
      id: q.id, type: q.type, stem: q.stem,
      imageUrl: q.imageName ? `/api/assess-files/${q.id}/${q.imageName}` : null,
      options: q.options,
      pickedIndex: an?.pickedIndex ?? null,
      correctIndex: q.correctIndex,
      isCorrect: an?.isCorrect ?? false,
      points: an?.points ?? 0, maxPoints: q.points,
    };
  });
  let stats: { questionId: string; pct: number; n: number }[] = [];
  if (as.showChart) {
    const submitted = await runAsSchool(db, a.school.id, (tx) =>
      tx.assessAttempt.findMany({
        where: { assessmentId: as.id, submittedAt: { not: null } },
        select: { id: true },
        take: 1000,
      }));
    const sIds = submitted.map((s) => s.id);
    if (sIds.length > 0) {
      const groups = await runAsSchool(db, a.school.id, (tx) =>
        tx.assessAnswer.groupBy({
          by: ["questionId", "isCorrect"],
          where: { attemptId: { in: sIds } },
          _count: { _all: true },
        }));
      const agg = new Map<string, { n: number; ok: number }>();
      for (const g of groups) {
        const cur = agg.get(g.questionId) ?? { n: 0, ok: 0 };
        cur.n += g._count._all;
        if (g.isCorrect) cur.ok += g._count._all;
        agg.set(g.questionId, cur);
      }
      stats = as.questions.map((q) => {
        const cur = agg.get(q.id) ?? { n: 0, ok: 0 };
        return { questionId: q.id, pct: cur.n === 0 ? 0 : Math.round((cur.ok / cur.n) * 100), n: cur.n };
      });
    }
  }
  return NextResponse.json({
    submitted: true,
    attempt: { id: attempt.id, score: attempt.score, maxScore: attempt.maxScore, submittedAt: attempt.submittedAt },
    assessment: { id: as.id, title: as.title, showChart: as.showChart },
    questions,
    stats,
  });
}
