import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { gradeSchema } from "@sms/shared/lms";
import { guruClassIds } from "@/server/lms-scope";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// POST /api/submissions/[id]/grade {score, feedback?} — nilai oleh guru kelasnya/admin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = gradeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const sub = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findUnique({
      where: { id: id.slice(0, 64) },
      include: { task: { select: { id: true, classId: true } } },
    }));
  if (!sub) return NextResponse.json({ error: "pengumpulan tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(sub.task.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const now = new Date();
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.update({
      where: { id: sub.id },
      data: { score: body.data.score, feedback: body.data.feedback ?? null, gradedById: a.userId, gradedAt: now },
    }));
  await logAuth(a.school.id, "TASK.GRADE", { actorId: a.userId, meta: { id: sub.id, score: body.data.score } });
  return NextResponse.json({ submission: { id: row.id, score: row.score } });
}
