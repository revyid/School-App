import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";

// GET /api/assessments/[id]/attempts — GURU (miliknya)/ADMIN: histori pengerjaan murid, read-only.
// Berisi nama, skor, jumlah benar, waktu kumpul. Tanpa jawaban per soal (lihat /result milik siswa).
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
      select: { id: true, title: true, authorId: true },
    }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  const attempts = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.findMany({
      where: { assessmentId: as.id },
      select: { id: true, studentId: true, score: true, maxScore: true, submittedAt: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 500,
    }));
  const ids = attempts.map((t) => t.studentId);
  const users = ids.length
    ? await runAsSchool(db, a.school.id, (tx) =>
        tx.user.findMany({
          where: { id: { in: [...new Set(ids)] } },
          select: { id: true, name: true },
        }))
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const aIds = attempts.map((t) => t.id);
  const groups = aIds.length
    ? await runAsSchool(db, a.school.id, (tx) =>
        tx.assessAnswer.groupBy({
          by: ["attemptId", "isCorrect"],
          where: { attemptId: { in: aIds } },
          _count: { _all: true },
        }))
    : [];
  const correctByAttempt = new Map<string, number>();
  const totalByAttempt = new Map<string, number>();
  for (const g of groups) {
    totalByAttempt.set(g.attemptId, (totalByAttempt.get(g.attemptId) ?? 0) + g._count._all);
    if (g.isCorrect) correctByAttempt.set(g.attemptId, (correctByAttempt.get(g.attemptId) ?? 0) + g._count._all);
  }
  return NextResponse.json({
    assessment: { id: as.id, title: as.title },
    rows: attempts.map((t) => ({
      id: t.id,
      studentName: nameById.get(t.studentId) ?? "—",
      score: t.score,
      maxScore: t.maxScore,
      correct: correctByAttempt.get(t.id) ?? 0,
      total: totalByAttempt.get(t.id) ?? 0,
      submittedAt: t.submittedAt,
    })),
  });
}
