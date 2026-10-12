import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { guruClassIds } from "./lms-scope";

export type Gradebook = {
  tasks: { id: string; title: string; deadline: string | null }[];
  assessments: { id: string; title: string; deadline: string | null }[];
  rows: {
    studentId: string;
    name: string;
    nisn: string | null;
    taskScores: Record<string, number | null>;
    assessScores: Record<string, number | null>;
    taskHistory: {
      taskId: string; title: string; state: string; deadline: string | null;
      submittedAt: string | null; isLate: boolean; score: number | null;
      feedback: string | null; gradedAt: string | null;
    }[];
    assessmentHistory: {
      assessmentId: string; title: string; state: string; attemptId: string | null;
      startedAt: string | null; submittedAt: string | null; score: number | null;
      maxScore: number | null; feedback: string | null; gradedAt: string | null;
    }[];
    avg: number | null;
  }[];
};

export async function buildGradebook(
  schoolId: string, role: string, userId: string, classId: string, subjectId: string | null,
): Promise<Gradebook | { error: string; status: number }> {
  if (!classId) return { error: "classId wajib diisi", status: 400 };
  if (role === "GURU") {
    const mine = await guruClassIds(schoolId, userId);
    if (!mine.has(classId)) return { error: "bukan kelas Anda", status: 403 };
  } else {
    const cls = await runAsSchool(db, schoolId, (tx) =>
      tx.class.findFirst({ where: { id: classId }, select: { id: true } }));
    if (!cls) return { error: "kelas tidak ditemukan", status: 404 };
  }

  const students = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findMany({
      where: { classId },
      select: { userId: true, user: { select: { name: true, nisn: true } } },
      orderBy: { user: { name: "asc" } },
      take: 200,
    }));
  const ids = students.map((s) => s.userId);
  const tasks = await runAsSchool(db, schoolId, (tx) =>
    tx.task.findMany({
      where: { classId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true, title: true, deadline: true, allowLate: true },
      take: 200,
    }));
  const assessments = await runAsSchool(db, schoolId, (tx) =>
    tx.assessment.findMany({
      where: { classId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true, title: true, deadline: true },
      take: 200,
    }));

  const submissions = ids.length && tasks.length
    ? await runAsSchool(db, schoolId, (tx) =>
      tx.submission.findMany({
        where: { studentId: { in: ids }, taskId: { in: tasks.map((t) => t.id) } },
        select: { id: true, studentId: true, taskId: true, submittedAt: true, isLate: true, score: true, feedback: true, gradedAt: true },
        take: 10000,
      }))
    : [];
  const attempts = ids.length && assessments.length
    ? await runAsSchool(db, schoolId, (tx) =>
      tx.assessAttempt.findMany({
        where: { studentId: { in: ids }, assessmentId: { in: assessments.map((x) => x.id) } },
        select: { id: true, studentId: true, assessmentId: true, startedAt: true, submittedAt: true, score: true, maxScore: true, feedback: true, gradedAt: true },
        take: 10000,
      }))
    : [];

  const subByKey = new Map(submissions.map((s) => [`${s.studentId}:${s.taskId}`, s]));
  const attemptByKey = new Map(attempts.map((a) => [`${a.studentId}:${a.assessmentId}`, a]));
  const now = Date.now();
  const rows = students.map((student) => {
    const taskScores: Record<string, number | null> = {};
    let taskSum = 0;
    let taskCount = 0;
    const taskHistory = tasks.map((task) => {
      const submission = subByKey.get(`${student.userId}:${task.id}`);
      taskScores[task.id] = submission?.score ?? null;
      if (submission?.score != null) { taskSum += submission.score; taskCount++; }
      const state = submission
        ? (submission.isLate ? "TERKUMPUL TERLAMBAT" : "TERKUMPUL")
        : task.deadline && task.deadline.getTime() < now
          ? (task.allowLate ? "BELUM TERKUMPUL · LEWAT (TERIMA TELAT)" : "BELUM TERKUMPUL · LEWAT")
          : "BELUM TERKUMPUL";
      return {
        taskId: task.id,
        title: task.title,
        state,
        deadline: task.deadline?.toISOString() ?? null,
        submittedAt: submission?.submittedAt.toISOString() ?? null,
        isLate: submission?.isLate ?? false,
        score: submission?.score ?? null,
        feedback: submission?.feedback ?? null,
        gradedAt: submission?.gradedAt?.toISOString() ?? null,
      };
    });

    const assessScores: Record<string, number | null> = {};
    let assessSum = 0;
    let assessCount = 0;
    const assessmentHistory = assessments.map((assessment) => {
      const attempt = attemptByKey.get(`${student.userId}:${assessment.id}`);
      const normalized = attempt?.score != null && attempt.maxScore
        ? Math.round((attempt.score / attempt.maxScore) * 100)
        : null;
      assessScores[assessment.id] = attempt?.submittedAt ? normalized : null;
      if (attempt?.submittedAt && normalized != null) { assessSum += normalized; assessCount++; }
      const state = attempt?.submittedAt
        ? "TERKUMPUL"
        : attempt
          ? assessment.deadline && assessment.deadline.getTime() < now ? "BELUM TERKUMPUL · LEWAT" : "SEDANG DIKERJAKAN"
          : assessment.deadline && assessment.deadline.getTime() < now ? "BELUM MULAI · LEWAT" : "BELUM MULAI";
      return {
        assessmentId: assessment.id,
        title: assessment.title,
        state,
        attemptId: attempt?.id ?? null,
        startedAt: attempt?.startedAt.toISOString() ?? null,
        submittedAt: attempt?.submittedAt?.toISOString() ?? null,
        score: attempt?.submittedAt ? attempt.score : null,
        maxScore: attempt?.submittedAt ? attempt.maxScore : null,
        feedback: attempt?.submittedAt ? attempt.feedback : null,
        gradedAt: attempt?.submittedAt ? attempt.gradedAt?.toISOString() ?? null : null,
      };
    });

    const parts: number[] = [];
    if (taskCount > 0) parts.push(taskSum / taskCount);
    if (assessCount > 0) parts.push(assessSum / assessCount);
    const avg = parts.length > 0 ? Math.round((parts.reduce((p, c) => p + c, 0) / parts.length) * 10) / 10 : null;
    return {
      studentId: student.userId,
      name: student.user.name,
      nisn: student.user.nisn,
      taskScores,
      assessScores,
      taskHistory,
      assessmentHistory,
      avg,
    };
  });

  return {
    tasks: tasks.map((task) => ({ id: task.id, title: task.title, deadline: task.deadline?.toISOString() ?? null })),
    assessments: assessments.map((assessment) => ({ id: assessment.id, title: assessment.title, deadline: assessment.deadline?.toISOString() ?? null })),
    rows,
  };
}
