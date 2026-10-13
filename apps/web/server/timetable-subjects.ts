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
