import { NextRequest, NextResponse } from "next/server";
import { apiGate } from "@/server/api-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { assessmentInputSchema } from "@lacakedu/shared/assess";
import { assertClassAccess } from "@/server/lms-scope";

function stripKeys<T extends { correctIndex?: unknown; correctOrder?: unknown }>(q: T): Omit<T, "correctIndex" | "correctOrder"> {
  const { correctIndex: _a, correctOrder: _b, ...rest } = q;
  return rest;
}

// GET /api/assessments — GURU: miliknya (+ADMIN semua). SISWA: yang publishAt lewat & kelasnya.
export async function GET(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const now = new Date();
  if (a.role === "SISWA") {
    const prof = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (!prof?.classId) return NextResponse.json({ rows: [] });
    const classId: string = prof.classId;
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.assessment.findMany({
        where: { OR: [{ classId }, { targets: { some: { classId } } }], publishAt: { lte: now } },
        select: {
          id: true, title: true, deadline: true, durationMin: true, createdAt: true, showChart: true,
          subjectId: true, subject: { select: { name: true } },
          attempts: { where: { studentId: a.userId }, select: { submittedAt: true, score: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }));
    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id, title: r.title, deadline: r.deadline, durationMin: r.durationMin,
        createdAt: r.createdAt, showChart: r.showChart,
        subjectId: r.subjectId, subjectName: r.subject?.name ?? null,
        submitted: !!r.attempts[0]?.submittedAt, score: r.attempts[0]?.score ?? null,
      })),
    });
  }
  const url = new URL(req.url);
  const classFilter = (url.searchParams.get("classId") ?? "").slice(0, 64) || null;
  const where: { authorId?: string; OR?: object[] } = {};
  if (a.role === "GURU") where.authorId = a.userId;
  if (classFilter) {
    const chk = await assertClassAccess(a.school.id, a.role, a.userId, classFilter);
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });
    where.OR = [{ classId: classFilter }, { targets: { some: { classId: classFilter } } }];
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        targets: { include: { class: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { questions: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }));
  return NextResponse.json({ rows: rows.map((r) => ({ ...r, questions: undefined })) });
}

// POST /api/assessments — GURU/ADMIN buat asesmen (snapshot soal dari bank + inline).
export async function POST(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:assess:${a.school.id}:${a.userId}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = assessmentInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "input tidak valid", detail: body.error.issues[0]?.message }, { status: 400 });
  }
  const v = body.data;
  // FASE 3 shared: classTargets (multi-kelas) atau fallback classId tunggal.
  const assessTargets: { classId: string; deadline?: string | null; publishAt?: string | null }[] =
    (v.classTargets?.length ? v.classTargets : [{
      classId: v.classId,
      deadline: v.deadline ?? null,
      publishAt: v.publishAt ?? null,
    }]);
  const assessClassIds = [...new Set(assessTargets.map((t) => t.classId))];
  if (a.role === "GURU") {
    const chk = await assertClassAccess(a.school.id, a.role, a.userId, assessClassIds);
    if (!chk.ok) {
      return NextResponse.json({ error: chk.error }, { status: chk.status });
    }
  } else {
    const cls = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findFirst({ where: { id: { in: assessClassIds } }, select: { id: true } }));
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
  const primary = assessTargets[0];
  const row = await runAsSchool(db, a.school.id, async (tx) => {
    const created = await tx.assessment.create({
      data: {
        schoolId: a.school.id,
        classId: primary.classId,
        subjectId: v.subjectId || null,
        authorId: a.userId,
        kind: "REGULAR",
        title: v.title,
        instruction: v.instruction || null,
        durationMin: v.durationMin ?? null,
        publishAt: primary.publishAt ? new Date(primary.publishAt) : new Date(),
        deadline: primary.deadline ? new Date(primary.deadline) : null,
        shuffleQ: v.shuffleQ,
        shuffleOpt: v.shuffleOpt,
        showChart: v.showChart,
        targets: {
          create: assessTargets.map((tg) => ({
            schoolId: a.school.id,
            classId: tg.classId,
            deadline: tg.deadline ? new Date(tg.deadline) : null,
            publishAt: tg.publishAt ? new Date(tg.publishAt) : new Date(),
          })),
        },
        questions: {
          create: [
            ...bank.map((q, i) => ({
              schoolId: a.school.id,
              type: q.type, stem: q.stem, imageName: q.imageName,
              videoName: (q as { videoName?: string | null }).videoName ?? null, options: q.options,
              points: 10, position: i,
              correctIndex: q.correctIndex, correctOrder: q.correctOrder,
            })),
            ...v.inline.map((q, i) => ({
              schoolId: a.school.id,
              type: q.type, stem: q.stem, imageName: q.imageName ?? null, videoName: q.videoName ?? null, options: q.options,
              points: 10, position: bank.length + i,
              correctIndex: q.type === "MCQ" ? (q.correctIndex ?? 0) : null,
              correctOrder: q.type === "SORTING" ? q.options.map((_, j) => j) : [],
            })),
          ],
        },
      },
      include: { _count: { select: { questions: true } } },
    });
    return created;
  });
  await logAuth(a.school.id, "ASSESS.CREATE", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ assessment: row }, { status: 201 });
}
