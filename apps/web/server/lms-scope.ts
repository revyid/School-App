// Helper scope LMS: guru hanya kelas yang diajar/diampu wali.
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

export async function guruClassIds(schoolId: string, guruId: string): Promise<Set<string>> {
  const mine = await runAsSchool(db, schoolId, (tx) =>
    tx.teacherClass.findMany({ where: { teacherId: guruId }, select: { classId: true } }));
  const homeroom = await runAsSchool(db, schoolId, (tx) =>
    tx.class.findMany({ where: { homeroomTeacherId: guruId }, select: { id: true } }));
  return new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
}

export async function siswaClassId(schoolId: string, siswaId: string): Promise<string | null> {
  const p = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: siswaId }, select: { classId: true } }));
  return p?.classId ?? null;
}
