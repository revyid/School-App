import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/assessments/[id]/diagnostic — distribusi skor (histogram 10 bucket) + rata-rata.
// DIAGNOSTIC maupun REGULAR bisa dibaca; guru hanya miliknya.
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
    tx.assessment.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, authorId: true, kind: true } }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  const attempts = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessAttempt.findMany({
      where: { assessmentId: as.id, submittedAt: { not: null } },
      select: { score: true, maxScore: true },
      take: 5000,
    }));
  const buckets = new Array<number>(10).fill(0);
  let sum = 0;
  let n = 0;
  for (const t of attempts) {
    if (t.score == null || !t.maxScore) continue;
    const pct = Math.max(0, Math.min(100, (t.score / t.maxScore) * 100));
    buckets[Math.min(9, Math.floor(pct / 10))]++;
    sum += pct;
    n++;
  }
  return NextResponse.json({
    kind: as.kind,
    n,
    avg: n === 0 ? 0 : Math.round((sum / n) * 10) / 10,
    buckets, // index 0 = 0-10, ..., 9 = 90-100
  });
}
