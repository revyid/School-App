import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { parseTimetableBuffer } from "@/server/timetable-xlsx";
import { resolveSubjectName } from "@/server/timetable-subjects";

const MAX_BYTES = 10 * 1024 * 1024;

// POST /api/timetable/import — ADMIN: upload .xlsx format sendiri
// (Hari|Mulai|Selesai|Mapel|Guru). FormData: file + classId.
// Nama mapel di-resolve ke Subject (find-or-create); nama guru dicocokkan
// ke user GURU se-sekolah (tak dikenal → error baris, tak dibatalkan semua).
export async function POST(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const classId = String(form?.get("classId") ?? "").slice(0, 64);
  if (!(file instanceof File)) return NextResponse.json({ error: "file .xlsx wajib diunggah" }, { status: 400 });
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "file melebihi 10MB" }, { status: 400 });
  const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: classId } }));
  if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });

  const parsed = parseTimetableBuffer(buf);
  // Gagal total (bukan xlsx / header salah) → 400. Baris rusak parsial → 200 + errors[].
  if (parsed.rows.length === 0 && parsed.errors.length > 0 && parsed.errors.every((e) => e.baris <= 1)) {
    return NextResponse.json({ error: parsed.errors[0]?.pesan ?? "file tidak valid", errors: parsed.errors }, { status: 400 });
  }

  const errors = [...parsed.errors];
  const valid: { dayOfWeek: number; startTime: string; endTime: string; subjectId: string | null; subjectName: string; teacherId: string | null }[] = [];
  await runAsSchool(db, a.school.id, async (tx) => {
    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      const baris = i + 2; // perkiraan nomor baris bila header di baris 1
      const sub = await resolveSubjectName(tx, a.school.id, r.subject);
      let teacherId: string | null = null;
      if (r.teacher.trim()) {
        const g = await tx.user.findFirst({ where: { role: "GURU", name: r.teacher.trim() } });
        if (!g) {
          errors.push({ baris, pesan: `guru tak dikenal: "${r.teacher.trim()}"` });
          continue;
        }
        teacherId = g.id;
      }
      valid.push({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        subjectId: sub.id,
        subjectName: r.subject.trim().slice(0, 128),
        teacherId,
      });
    }
    if (valid.length > 0) {
      await tx.timetableSlot.createMany({
        data: valid.map((v) => ({ schoolId: a.school.id, classId, ...v })),
      });
    }
  });

  await logAuth(a.school.id, "TIMETABLE.IMPORT", {
    actorId: a.userId,
    meta: { classId, ok: valid.length, gagal: errors.length },
  });
  return NextResponse.json({ ok: valid.length, gagal: errors.length, errors });
}
