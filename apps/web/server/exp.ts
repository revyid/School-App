// EXP: poin per aksi siswa, aturan configurable per sekolah (settings.expRules JSON).
// Idempoten via dedupeKey (gagal duplikat = sudah diberi, bukan error).
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

type Rules = {
  submitTepat?: number;
  submitTerlambat?: number;
  hadirHarian?: number;
  streakBonus?: number;
};

const DEFAULTS: Required<Rules> = {
  submitTepat: 10,
  submitTerlambat: 3,
  hadirHarian: 5,
  streakBonus: 20,
};

export async function expRules(schoolId: string): Promise<Required<Rules>> {
  const s = await runAsSchool(db, schoolId, (tx) =>
    tx.schoolSettings.findUnique({
      where: { schoolId },
      select: { expRules: true },
    }));
  const r = (s?.expRules as Rules | null) ?? {};
  return { ...DEFAULTS, ...r };
}

export async function awardExp(
  schoolId: string,
  studentId: string,
  kind: keyof Rules,
  dedupeKey: string,
): Promise<{ points: number } | { skipped: true }> {
  const rules = await expRules(schoolId);
  const points = rules[kind] ?? 0;
  if (points <= 0) return { skipped: true };
  try {
    await runAsSchool(db, schoolId, (tx) =>
      tx.expLog.create({
        data: {
          schoolId, studentId, points,
          reason: kind,
          dedupeKey: dedupeKey.slice(0, 128),
        },
      }));
  } catch {
    return { skipped: true }; // dedupeKey duplikat = sudah diberi
  }
  return { points };
}

export async function studentExp(schoolId: string, studentId: string): Promise<number> {
  const rows = await runAsSchool(db, schoolId, (tx) =>
    tx.expLog.findMany({ where: { studentId }, select: { points: true }, take: 5000 }));
  return rows.reduce((s, r) => s + r.points, 0);
}

export async function classLeaderboard(schoolId: string, classId: string, limit = 20): Promise<{ studentId: string; name: string; points: number }[]> {
  const profiles = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findMany({
      where: { classId },
      select: { userId: true, user: { select: { name: true } } },
      take: 200,
    }));
  const rows: { studentId: string; name: string; points: number }[] = [];
  for (const p of profiles) {
    rows.push({ studentId: p.userId, name: p.user.name, points: await studentExp(schoolId, p.userId) });
  }
  return rows.sort((a, b) => b.points - a.points).slice(0, limit);
}
