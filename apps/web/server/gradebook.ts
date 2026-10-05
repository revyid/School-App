import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { guruClassIds } from "./lms-scope";

export type Gradebook = {
  tasks: { id: string; title: string }[];
  assessments: { id: string; title: string }[];
  rows: {
    studentId: string; name: string; nisn: string | null;
    taskScores: Record<string, number | null>;
    assessScores: Record<string, number | null>;
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
      select: { id: true, title: true },
      take: 200,
    }));
  const subs = ids.length > 0
    ? await runAsSchool(db, schoolId, (tx) =>
      tx.submission.findMany({
        where: { studentId: { in: ids }, taskId: { in: tasks.map((t) => t.id) } },
        select: { studentId: true, taskId: true, score: true },
        take: 5000,
      }))
    : [];

  const assessments = await runAsSchool(db, schoolId, (tx) =>
    tx.assessment.findMany({
      where: { classId, ...(subjectId ? { subjectId } : {}) },
      select: { id: true, title: true },
      take: 200,
    }));
  const attempts = ids.length > 0
    ? await runAsSchool(db, schoolId, (tx) =>
      tx.assessAttempt.findMany({
        where: { studentId: { in: ids }, assessmentId: { in: assessments.map((x) => x.id) }, submittedAt: { not: null } },
        select: { studentId: true, assessmentId: true, score: true, maxScore: true },
        take: 5000,
      }))
    : [];

  const subByKey = new Map(subs.map((s) => [`${s.studentId}:${s.taskId}`, s]));
  const attByKey = new Map(attempts.map((t) => [`${t.studentId}:${t.assessmentId}`, t]));
  const rows = students.map((s) => {
    const taskScores: Record<string, number | null> = {};
    let tSum = 0;
    let tN = 0;
    for (const t of tasks) {
      const sub = subByKey.get(`${s.userId}:${t.id}`);
      taskScores[t.id] = sub?.score ?? null;
      if (sub?.score != null) {
        tSum += sub.score;
        tN++;
      }
    }
    const assessScores: Record<string, number | null> = {};
    let aSum = 0;
    let aN = 0;
    for (const x of assessments) {
      const at = attByKey.get(`${s.userId}:${x.id}`);
      const norm = at?.score != null && at.maxScore ? Math.round((at.score / at.maxScore) * 100) : null;
      assessScores[x.id] = norm;
      if (norm != null) {
        aSum += norm;
        aN++;
      }
    }
    const parts: number[] = [];
    if (tN > 0) parts.push(tSum / tN);
    if (aN > 0) parts.push(aSum / aN);
    const avg = parts.length > 0 ? Math.round((parts.reduce((p, c) => p + c, 0) / parts.length) * 10) / 10 : null;
    return {
      studentId: s.userId, name: s.user.name, nisn: s.user.nisn,
      taskScores, assessScores, avg,
    };
  });
  return {
    tasks: tasks.map((t) => ({ id: t.id, title: t.title })),
    assessments: assessments.map((x) => ({ id: x.id, title: x.title })),
    rows,
  };
}
