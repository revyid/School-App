import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
// Resolve nama mapel bebas → Subject.id (find-or-create per sekolah).
// Dipakai POST/PATCH/import timetable agar format Excel bebas (kolom Mapel teks)
// tetap terhubung ke tabel Subject (dropdown guru + auto-mapping).
interface SubjectTx {
  subject: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findFirst: (args: any) => Promise<{ id: string } | null>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (args: any) => Promise<{ id: string }>;
  };
}

/** Nama kosong → { id: null }. Balapan create → find ulang (unique school+name). */
export async function resolveSubjectName(
  tx: SubjectTx,
  schoolId: string,
  raw: string,
): Promise<{ id: string | null }> {
  const name = raw.trim().slice(0, 128);
  if (!name) return { id: null };
  const found = await tx.subject.findFirst({ where: { schoolId, name } });
  if (found) return { id: found.id };
  try {
    const created = await tx.subject.create({ data: { schoolId, name } });
    return { id: created.id };
  } catch {
    const retry = await tx.subject.findFirst({ where: { schoolId, name } });
    return { id: retry?.id ?? null };
  }
}

// Validasi relasi slot timetable se-sekolah (dipakai POST & PATCH).
// Pesan + status identik dengan validasi inline sebelumnya.
export async function validateSlotRefs(
  schoolId: string, d: { classId: string; subjectId?: string | null; teacherId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const cls = await runAsSchool(db, schoolId, (tx) => tx.class.findUnique({ where: { id: d.classId } }));
  if (!cls) return { ok: false, error: "kelas tidak ditemukan", status: 400 };
  if (d.subjectId) {
    const s = await runAsSchool(db, schoolId, (tx) => tx.subject.findUnique({ where: { id: d.subjectId! } }));
    if (!s) return { ok: false, error: "mapel tidak ditemukan", status: 400 };
  }
  if (d.teacherId) {
    const t = await runAsSchool(db, schoolId, (tx) =>
      tx.user.findFirst({ where: { id: d.teacherId!, role: "GURU" } }));
    if (!t) return { ok: false, error: "guru tidak ditemukan", status: 400 };
  }
  return { ok: true };
}
