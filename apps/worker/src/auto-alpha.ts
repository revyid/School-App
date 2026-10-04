// Auto-Alpha cron: tiap tick, untuk tiap sekolah tentukan apakah cutoffTime
// hari ini sudah lewat; bila ya, tandai ALPHA siswa tanpa record.
// Gagal satu sekolah tidak menghentikan sekolah lain.
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { todayWib, pickAutoAlpha } from "@sms/shared/attendance";

function cutoffPassed(cutoff: string, nowWib: Date): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(cutoff);
  if (!m) return false;
  const t = new Date(nowWib);
  t.setUTCHours(Number(m[1]), Number(m[2]), 0, 0);
  return nowWib.getTime() >= t.getTime();
}

export async function runAutoAlphaTick(now = new Date()): Promise<{ schools: number; alpha: number; errors: string[] }> {
  const errors: string[] = [];
  let schools = 0;
  let alpha = 0;
  const day = todayWib();
  const nowWib = new Date(now.getTime() + 7 * 3600 * 1000);
  // Dow (0=Min..6=Sab) dari kalender WIB.
  const dow = new Date(now.getTime() + 7 * 3600 * 1000).getUTCDay();

  const all = await db.school.findMany({ select: { id: true } });
  for (const s of all) {
    try {
      const settings = await runAsSchool(db, s.id, (tx) =>
        tx.schoolSettings.findUnique({ where: { schoolId: s.id } }),
      );
      const cutoff = settings?.cutoffTime ?? "07:30";
      if (!cutoffPassed(cutoff, nowWib)) continue;
      schools++;

      const calendar = await runAsSchool(db, s.id, (tx) =>
        tx.academicCalendar.findMany({ where: { date: day }, select: { kind: true, classId: true } }),
      );
      const students = await runAsSchool(db, s.id, (tx) =>
        tx.user.findMany({
          where: { role: "SISWA", isActive: true },
          select: { id: true, studentProfile: { select: { classId: true } } },
        }),
      );
      const recs = await runAsSchool(db, s.id, (tx) =>
        tx.attendanceRecord.findMany({
          where: { date: day },
          select: { studentId: true, status: true },
        }),
      );
      const existing = new Map(recs.map((r) => [r.studentId, r.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"]));
      const slots = await runAsSchool(db, s.id, (tx) =>
        tx.timetableSlot.findMany({ where: { dayOfWeek: dow }, select: { classId: true } }),
      );
      const withSchedule = new Set(slots.map((x) => x.classId));
      // Phase 6 (izin APPROVED) menyambung di sini; sementara kosong.
      const approvedLeave = new Set<string>();

      const targets = pickAutoAlpha({
        students: students.map((u) => ({ id: u.id, classId: u.studentProfile?.classId ?? null })),
        existing,
        calendar: calendar.map((c) => ({ kind: c.kind as "LIBUR" | "EFEKTIF", classId: c.classId })),
        approvedLeave,
        hasTimetable: (classId) => (classId ? withSchedule.has(classId) : false),
      });

      for (const sid of targets) {
        const prof = students.find((u) => u.id === sid)?.studentProfile;
        await runAsSchool(db, s.id, (tx) =>
          tx.attendanceRecord.upsert({
            where: { schoolId_studentId_date: { schoolId: s.id, studentId: sid, date: day } },
            update: {},
            create: {
              schoolId: s.id,
              studentId: sid,
              classId: prof?.classId ?? null,
              date: day,
              status: "ALPHA",
              source: "AUTO",
            },
          }),
        );
        alpha++;
      }
    } catch (e) {
      errors.push(`${s.id}: ${(e as Error).message}`);
    }
  }
  return { schools, alpha, errors };
}
