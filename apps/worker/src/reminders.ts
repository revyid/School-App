// Pemicu notifikasi worker-side:
// 1. Alert Alpha -> nomor ortu (WA) + notifikasi in-app ke siswa.
// 2. Pengingat H-1 tugas dan asesmen -> siswa yang belum mengumpulkan (in-app + WA ortu bila ada).
// Semua pemicu ber-idempotensi agar tick worker berulang tidak menggandakan pesan.
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { renderTemplate, DEFAULT_TEMPLATES } from "@sms/shared/notify";
import { dayKey } from "@sms/shared/attendance";

let _q: Queue | null = null;
function q(): Queue {
  if (!_q) {
    _q = new Queue("wa", {
      connection: new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
    });
  }
  return _q;
}

async function enqueueDedupe(
  schoolId: string,
  to: string,
  text: string,
  dedupeKey: string,
): Promise<boolean> {
  const prev = await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.findUnique({ where: { schoolId_dedupeKey: { schoolId, dedupeKey } } }),
  );
  if (prev) return false;
  try {
    const row = await runAsSchool(db, schoolId, (tx) =>
      tx.messageOutbox.create({ data: { schoolId, to, text, dedupeKey, status: "QUEUED" } }),
    );
    await q().add("send", { schoolId, outboxId: row.id }, {
      jobId: `wa-${row.id}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    return true;
  } catch {
    return false;
  }
}

async function notifyOnce(schoolId: string, userId: string, title: string, body: string, dedupeKey: string) {
  await runAsSchool(db, schoolId, (tx) => tx.notification.createMany({
    data: [{ schoolId, userId, title, body, dedupeKey }],
    skipDuplicates: true,
  }));
}

// Dipanggil setelah auto-alpha menandai ALPHA (atau scan manual oleh cron harian):
// kirim alert untuk record ALPHA hari ini yang belum pernah dialert.
export async function sendAlphaAlerts(schoolId: string, date: Date): Promise<number> {
  let sent = 0;
  const recs = await runAsSchool(db, schoolId, (tx) =>
    tx.attendanceRecord.findMany({
      where: { date, status: "ALPHA" },
      include: {
        student: {
          select: {
            id: true, name: true,
            studentProfile: { select: { parentPhone: true, class: { select: { name: true } } } },
          },
        },
      },
      take: 2000,
    }));
  const key = dayKey(date);
  for (const r of recs) {
    const phone = r.student.studentProfile?.parentPhone;
    const className = r.student.studentProfile?.class?.name ?? "-";
    const body = `Kamu tercatat ALPHA pada ${key}. Hubungi wali kelas bila ada kekeliruan.`;
    await notifyOnce(schoolId, r.student.id, "Alpha hari ini", body, `alpha-${r.studentId}-${key}`.slice(0, 128)).catch(() => {});
    if (phone) {
      const text = renderTemplate(DEFAULT_TEMPLATES.alpha, {
        nama: r.student.name, kelas: className, tanggal: key,
      });
      if (await enqueueDedupe(schoolId, phone, text, `alpha-${r.studentId}-${key}`)) sent++;
    }
  }
  return sent;
}

function nextWibDayWindow(now: Date): { start: Date; end: Date } {
  const wibOffset = 7 * 60 * 60 * 1000;
  const wibNow = new Date(now.getTime() + wibOffset);
  const nextMidnightWib = Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate() + 1);
  return {
    start: new Date(nextMidnightWib - wibOffset),
    end: new Date(nextMidnightWib + 24 * 60 * 60 * 1000 - wibOffset),
  };
}

// Pengingat H-1 untuk tugas dan asesmen yang sudah terlihat oleh siswa.
export async function runDeadlineReminders(now = new Date()): Promise<{ schools: number; reminded: number }> {
  let schools = 0;
  let reminded = 0;
  const all = await db.school.findMany({ select: { id: true } });
  const { start, end } = nextWibDayWindow(now);
  for (const school of all) {
    try {
      const [tasks, assessments] = await Promise.all([
        runAsSchool(db, school.id, (tx) => tx.task.findMany({
          where: { publishAt: { lte: now }, deadline: { gte: start, lt: end } },
          select: { id: true, title: true, deadline: true, classId: true },
          take: 500,
        })),
        runAsSchool(db, school.id, (tx) => tx.assessment.findMany({
          where: { publishAt: { lte: now }, deadline: { gte: start, lt: end } },
          select: { id: true, title: true, deadline: true, classId: true },
          take: 500,
        })),
      ]);
      if (!tasks.length && !assessments.length) continue;
      schools++;

      for (const task of tasks) {
        const submitted = await runAsSchool(db, school.id, (tx) =>
          tx.submission.findMany({ where: { taskId: task.id }, select: { studentId: true } }));
        const done = new Set(submitted.map((row) => row.studentId));
        const roster = await runAsSchool(db, school.id, (tx) =>
          tx.studentProfile.findMany({
            where: { classId: task.classId },
            include: { user: { select: { id: true, name: true } } },
            take: 1000,
          }));
        const deadline = task.deadline?.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-";
        for (const student of roster) {
          if (done.has(student.user.id)) continue;
          const body = `Tugas "${task.title}" tenggat ${deadline}. Segera kumpulkan.`;
          const key = `h-1-task-${task.id}-${student.user.id}`.slice(0, 128);
          await notifyOnce(school.id, student.user.id, "Pengingat tugas", body, key).catch(() => {});
          if (student.parentPhone) {
            const text = renderTemplate(DEFAULT_TEMPLATES.reminder, {
              nama: student.user.name, judul: task.title, deadline,
            });
            if (await enqueueDedupe(school.id, student.parentPhone, text, key)) reminded++;
          }
        }
      }

      for (const assessment of assessments) {
        const submitted = await runAsSchool(db, school.id, (tx) =>
          tx.assessAttempt.findMany({
            where: { assessmentId: assessment.id, submittedAt: { not: null } },
            select: { studentId: true },
          }));
        const done = new Set(submitted.map((row) => row.studentId));
        const roster = await runAsSchool(db, school.id, (tx) =>
          tx.studentProfile.findMany({
            where: { classId: assessment.classId },
            include: { user: { select: { id: true, name: true } } },
            take: 1000,
          }));
        const deadline = assessment.deadline?.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) ?? "-";
        for (const student of roster) {
          if (done.has(student.user.id)) continue;
          const body = `Asesmen "${assessment.title}" tenggat ${deadline}. Segera kerjakan dan kumpulkan.`;
          const key = `h-1-assess-${assessment.id}-${student.user.id}`.slice(0, 128);
          await notifyOnce(school.id, student.user.id, "Pengingat asesmen", body, key).catch(() => {});
          if (student.parentPhone) {
            const text = `Pengingat sekolah: ${student.user.name} belum mengumpulkan asesmen "${assessment.title}" dengan tenggat ${deadline}.`;
            if (await enqueueDedupe(school.id, student.parentPhone, text, key)) reminded++;
          }
        }
      }
    } catch (error) {
      console.error(`reminder gagal ${school.id}:`, (error as Error).message);
    }
  }
  return { schools, reminded };
}
