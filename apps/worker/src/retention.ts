// Retensi foto izin: hapus file + null-kan referensi setelah photoRetentionDays.
// Cron harian worker; gagal satu sekolah tidak menghentikan yang lain.
import { unlink } from "node:fs/promises";
import path from "node:path";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

async function deleteLeaveFile(schoolId: string, name: string): Promise<void> {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  const base = path.basename(name);
  const p = path.join(root, schoolId, "leave", base);
  if (!p.startsWith(path.join(root, schoolId))) return;
  try {
    await unlink(p);
  } catch {
    // sudah hilang -> beres
  }
}

export async function runLeaveRetention(now = new Date()): Promise<{ schools: number; purged: number }> {
  let schools = 0;
  let purged = 0;
  const all = await db.school.findMany({ select: { id: true } });
  for (const s of all) {
    try {
      const settings = await runAsSchool(db, s.id, (tx) =>
        tx.schoolSettings.findUnique({ where: { schoolId: s.id } }),
      );
      const days = settings?.photoRetentionDays ?? 30;
      const cutoff = new Date(now.getTime() - days * 24 * 3600_000);
      const olds = await runAsSchool(db, s.id, (tx) =>
        tx.leaveRequest.findMany({
          where: {
            createdAt: { lt: cutoff },
            OR: [{ studentPhoto: { not: null } }, { parentPhoto: { not: null } }],
          },
          select: { id: true, studentPhoto: true, parentPhoto: true },
          take: 500,
        }));
      if (olds.length === 0) continue;
      schools++;
      for (const o of olds) {
        if (o.studentPhoto) await deleteLeaveFile(s.id, o.studentPhoto).catch(() => {});
        if (o.parentPhoto) await deleteLeaveFile(s.id, o.parentPhoto).catch(() => {});
        await runAsSchool(db, s.id, (tx) =>
          tx.leaveRequest.update({
            where: { id: o.id },
            data: { studentPhoto: null, parentPhoto: null },
          }));
        purged++;
      }
    } catch (e) {
      console.error(`retensi gagal ${s.id}:`, (e as Error).message);
    }
  }
  return { schools, purged };
}
