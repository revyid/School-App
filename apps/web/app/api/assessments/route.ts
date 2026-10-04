import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { assessmentInputSchema } from "@sms/shared/assess";
import { guruClassIds } from "@/server/lms-scope";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

function stripKeys<T extends { correctIndex?: unknown; correctOrder?: unknown }>(q: T): Omit<T, "correctIndex" | "correctOrder"> {
  const { correctIndex: _a, correctOrder: _b, ...rest } = q;
  return rest;
}

// GET /api/assessments — GURU: miliknya (+ADMIN semua). SISWA: yang publishAt lewat & kelasnya.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const now = new Date();
  if (a.role === "SISWA") {
    const prof = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (!prof?.classId) return NextResponse.json({ rows: [] });
    const classId: string = prof.classId;
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.assessment.findMany({
        where: { classId, publishAt: { lte: now } },
        select: { id: true, kind: true, title: true, deadline: true, durationMin: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }));
    return NextResponse.json({ rows });
  }
  const where: { authorId?: string } = {};
  if (a.role === "GURU") where.authorId = a.userId;
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findMany({
      where,
      include: { _count: { select: { questions: true, attempts: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }));
  return NextResponse.json({ rows: rows.map((r) => ({ ...r, questions: undefined })) });
}

// POST /api/assessments — GURU/ADMIN buat asesmen (snapshot soal dari bank + inline).
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:assess:${a.school.id}:${a.userId}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = assessmentInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "input tidak valid", detail: body.error.issues[0]?.message }, { status: 400 });
  }
  const v = body.data;
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(v.classId)) {
      return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    }
  } else {
    const cls = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findFirst({ where: { id: v.classId }, select: { id: true } }));
    if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 404 });
  }
  // Ambil bank milik guru ini (ADMIN boleh ambil bank siapa pun di sekolahnya).
  const bank = v.questionIds.length > 0
    ? await runAsSchool(db, a.school.id, (tx) =>
      tx.question.findMany({
        where: {
          id: { in: v.questionIds },
          ...(a.role === "GURU" ? { authorId: a.userId } : {}),
        },
        take: 100,
      }))
    : [];
  if (bank.length !== v.questionIds.length) {
    return NextResponse.json({ error: "sebagian soal bank bukan milik Anda / tidak ditemukan" }, { status: 403 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.create({
      data: {
        schoolId: a.school.id,
        classId: v.classId,
        subjectId: v.subjectId || null,
        authorId: a.userId,
        kind: v.kind,
        title: v.title,
        instruction: v.instruction || null,
        durationMin: v.durationMin ?? null,
        publishAt: v.publishAt ? new Date(v.publishAt) : new Date(),
        deadline: v.deadline ? new Date(v.deadline) : null,
        shuffleQ: v.shuffleQ,
        shuffleOpt: v.shuffleOpt,
        questions: {
          create: [
            ...bank.map((q, i) => ({
              schoolId: a.school.id,
              type: q.type, stem: q.stem, imageName: q.imageName, options: q.options,
              points: 10, position: i,
              correctIndex: q.correctIndex, correctOrder: q.correctOrder,
            })),
            ...v.inline.map((q, i) => ({
              schoolId: a.school.id,
              type: q.type, stem: q.stem, imageName: q.imageName ?? null, options: q.options,
              points: 10, position: bank.length + i,
              correctIndex: q.type === "MCQ" ? (q.correctIndex ?? 0) : null,
              correctOrder: q.type === "SORTING" ? q.options.map((_, j) => j) : [],
            })),
          ],
        },
      },
      include: { _count: { select: { questions: true } } },
    }));
  await logAuth(a.school.id, "ASSESS.CREATE", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ assessment: row }, { status: 201 });
}
