// Helper scope LMS: guru hanya kelas yang diajar/diampu wali.
// "Diajar" dibaca LIVE dari TimetableSlot (shared data — tidak ada tabel cache).
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

export async function guruSlotClasses(schoolId: string, guruId: string): Promise<Set<string>> {
  const rows = await runAsSchool(db, schoolId, (tx) =>
    tx.timetableSlot.findMany({ where: { teacherId: guruId }, select: { classId: true } }));
  return new Set(rows.map((r) => r.classId));
}

export async function guruClassIds(schoolId: string, guruId: string): Promise<Set<string>> {
  const [slot, homeroom] = await Promise.all([
    guruSlotClasses(schoolId, guruId),
    runAsSchool(db, schoolId, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: guruId }, select: { id: true } })),
  ]);
  return new Set([...slot, ...homeroom.map((h) => h.id)]);
}

export async function siswaClassId(schoolId: string, siswaId: string): Promise<string | null> {
  const p = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: siswaId }, select: { classId: true } }));
  return p?.classId ?? null;
}

// Assert akses kelas: GURU hanya kelas yang diajar/diampu; ADMIN lolos (cek
// eksistensi tetap inline di caller karena status error-nya beda per route).
export async function assertClassAccess(
  schoolId: string, role: string, userId: string, classIds: string | string[],
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (role !== "GURU") return { ok: true };
  const ids = Array.isArray(classIds) ? classIds : [classIds];
  const mine = await guruClassIds(schoolId, userId);
  if (ids.some((c) => !mine.has(c))) return { ok: false, error: "bukan kelas Anda", status: 403 };
  return { ok: true };
}
