// Pemicu notifikasi worker-side (cron):
// 1. Alert Alpha -> nomor ortu (WA) + notifikasi in-app ke siswa.
// 2. Pengingat H-1 deadline -> siswa yang belum mengumpulkan (in-app + WA ortu bila ada).
// Idempotent via dedupeKey outbox; gagal satu sekolah tidak menghentikan yang lain.
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { renderTemplate, DEFAULT_TEMPLATES } from "@sms/shared/notify";
import { todayWib, dayKey } from "@sms/shared/attendance";

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
    // In-app ke siswa (selalu), WA ke ortu bila nomor ada.
    await runAsSchool(db, schoolId, (tx) =>
      tx.notification.create({
        data: {
          schoolId, userId: r.student.id,
          title: "Alpha hari ini",
          body: `Kamu tercatat ALPHA pada ${key}. Hubungi wali kelas bila ada kekeliruan.`,
        },
      }),
    ).catch(() => {});
    if (phone) {
      const text = renderTemplate(DEFAULT_TEMPLATES.alpha, {
        nama: r.student.name, kelas: className, tanggal: key,
      });
      if (await enqueueDedupe(schoolId, phone, text, `alpha-${r.studentId}-${key}`)) sent++;
    }
  }
  return sent;
}

// Pengingat H-1: tugas ber-deadline besok -> siswa yang belum mengumpulkan.
export async function runDeadlineReminders(now = new Date()): Promise<{ schools: number; reminded: number }> {
  let schools = 0;
  let reminded = 0;
  const all = await db.school.findMany({ select: { id: true } });
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));
  void todayWib;
  for (const s of all) {
    try {
      const tasks = await runAsSchool(db, s.id, (tx) =>
        tx.task.findMany({
          where: { deadline: { gte: start, lt: end } },
          select: { id: true, title: true, deadline: true, classId: true },
          take: 500,
        }));
      if (tasks.length === 0) continue;
      schools++;
      for (const t of tasks) {
        const subs = await runAsSchool(db, s.id, (tx) =>
          tx.submission.findMany({ where: { taskId: t.id }, select: { studentId: true } }));
        const done = new Set(subs.map((x) => x.studentId));
        const roster = await runAsSchool(db, s.id, (tx) =>
          tx.studentProfile.findMany({
            where: { classId: t.classId },
            include: { user: { select: { id: true, name: true } } },
            take: 1000,
          }));
        const dl = t.deadline ? new Date(t.deadline).toLocaleDateString("id-ID") : "-";
        for (const r of roster) {
          if (done.has(r.user.id)) continue;
          await runAsSchool(db, s.id, (tx) =>
            tx.notification.create({
              data: {
                schoolId: s.id, userId: r.user.id,
                title: "Pengingat tugas",
                body: `Tugas "${t.title}" tenggat ${dl}. Segera kumpulkan.`,
              },
            }),
          ).catch(() => {});
          const phone = r.parentPhone;
          if (phone) {
            const text = renderTemplate(DEFAULT_TEMPLATES.reminder, {
              nama: r.user.name, judul: t.title, deadline: dl,
            });
            if (await enqueueDedupe(s.id, phone, text, `h-1-${t.id}-${r.user.id}`)) reminded++;
          }
        }
      }
    } catch (e) {
      console.error(`reminder gagal ${s.id}:`, (e as Error).message);
    }
  }
  return { schools, reminded };
}
