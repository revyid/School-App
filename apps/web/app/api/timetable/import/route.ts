import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { parseTimetableBuffer, parseTimetableAllBuffer } from "@/server/timetable-xlsx";
import { resolveSubjectName } from "@/server/timetable-subjects";

const MAX_BYTES = 10 * 1024 * 1024;

// POST /api/timetable/import — ADMIN: upload .xlsx.
// Dua mode (deteksi otomatis dari header):
// - Per-kelas (Hari|Mulai|Selesai|Mapel|Guru): butuh classId di form, tambah ke kelas itu.
// - Global (Kelas|Hari|Mulai|Selesai|Mapel|Guru): satu file untuk semua kelas;
//   ?mode=replace (default) hapus slot kelas-kelas di file dulu, ?mode=merge hanya tambah.
// Nama mapel di-resolve ke Subject (find-or-create); nama guru/kelas dicocokkan
// case-insensitive (tak dikenal → error baris, tak dibatalkan semua).
// Tak ada langkah sync — pembaca penugasan query slot langsung.
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
  if (!(file instanceof File)) return NextResponse.json({ error: "file .xlsx wajib diunggah" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "file melebihi 10MB" }, { status: 400 });
  const mode = new URL(req.url).searchParams.get("mode") === "merge" ? "merge" : "replace";

  // Deteksi format: coba global dulu (header Kelas|...), fallback per-kelas.
  const allParsed = parseTimetableAllBuffer(buf);
  const isAll = allParsed.rows.length > 0 || allParsed.errors.some((e) => e.baris > 1);

  if (isAll) {
    return importAll(a.school.id, a.userId, allParsed, mode);
  }

  // --- Mode per-kelas (aliran lama) ---
  const classId = String(form?.get("classId") ?? "").slice(0, 64);
  if (!classId) return NextResponse.json({ error: "classId wajib diisi (atau pakai template semua-kelas)" }, { status: 400 });
  const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: classId } }));
  if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });

  const parsed = parseTimetableBuffer(buf);
  if (parsed.rows.length === 0 && parsed.errors.length > 0 && parsed.errors.every((e) => e.baris <= 1)) {
    return NextResponse.json({ error: parsed.errors[0]?.pesan ?? "file tidak valid", errors: parsed.errors }, { status: 400 });
  }

  const errors = [...parsed.errors];
  const valid: { dayOfWeek: number; startTime: string; endTime: string; subjectId: string | null; subjectName: string; teacherId: string | null }[] = [];
  await runAsSchool(db, a.school.id, async (tx) => {
    const gurus = await tx.user.findMany({ where: { role: "GURU" }, select: { id: true, name: true } });
    const byName = new Map(gurus.map((g) => [g.name.trim().toLowerCase(), g.id]));
    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      const baris = i + 2;
      const sub = await resolveSubjectName(tx, a.school.id, r.subject);
      let teacherId: string | null = null;
      if (r.teacher.trim()) {
        const gid = byName.get(r.teacher.trim().toLowerCase());
        if (!gid) { errors.push({ baris, pesan: `guru tak dikenal: "${r.teacher.trim()}"` }); continue; }
        teacherId = gid;
      }
      valid.push({
        dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
        subjectId: sub.id, subjectName: r.subject.trim().slice(0, 128), teacherId,
      });
    }
    if (valid.length > 0) {
      await tx.timetableSlot.createMany({
        data: valid.map((v) => ({ schoolId: a.school.id, classId, ...v })),
      });
    }
  });

  await logAuth(a.school.id, "TIMETABLE.IMPORT", {
    actorId: a.userId, meta: { classId, ok: valid.length, gagal: errors.length },
  });
  return NextResponse.json({ ok: valid.length, gagal: errors.length, errors });
}

async function importAll(
  schoolId: string, userId: string,
  parsed: ReturnType<typeof parseTimetableAllBuffer>, mode: "replace" | "merge",
) {
  const errors = [...parsed.errors];
  let created = 0;
  await runAsSchool(db, schoolId, async (tx) => {
    const [kelasRows, gurus] = await Promise.all([
      tx.class.findMany({ select: { id: true, name: true } }),
      tx.user.findMany({ where: { role: "GURU" }, select: { id: true, name: true } }),
    ]);
    const kelasByName = new Map(kelasRows.map((c) => [c.name.trim().toLowerCase(), c.id]));
    const guruByName = new Map(gurus.map((g) => [g.name.trim().toLowerCase(), g.id]));
    type V = {
      dayOfWeek: number; startTime: string; endTime: string;
      subjectId: string | null; subjectName: string; teacherId: string | null;
    };
    const buckets = new Map<string, V[]>();
    for (let i = 0; i < parsed.rows.length; i++) {
      const r = parsed.rows[i];
      const baris = i + 2;
      const classId = kelasByName.get(r.kelas.trim().toLowerCase());
      if (!classId) { errors.push({ baris, pesan: `kelas tak dikenal: "${r.kelas.trim()}"` }); continue; }
      const sub = await resolveSubjectName(tx, schoolId, r.subject);
      let teacherId: string | null = null;
      if (r.teacher.trim()) {
        const gid = guruByName.get(r.teacher.trim().toLowerCase());
        if (!gid) { errors.push({ baris, pesan: `guru tak dikenal: "${r.teacher.trim()}"` }); continue; }
        teacherId = gid;
      }
      const list = buckets.get(classId) ?? [];
      list.push({
        dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
        subjectId: sub.id, subjectName: r.subject.trim().slice(0, 128), teacherId,
      });
      buckets.set(classId, list);
    }
    if (mode === "replace" && buckets.size > 0) {
      await tx.timetableSlot.deleteMany({
        where: { schoolId, classId: { in: [...buckets.keys()] } },
      });
    }
    for (const [classId, list] of buckets) {
      if (list.length === 0) continue;
      await tx.timetableSlot.createMany({
        data: list.map((v) => ({ schoolId, classId, ...v })),
      });
      created += list.length;
    }
  });

  await logAuth(schoolId, "TIMETABLE.IMPORT_ALL", {
    actorId: userId, meta: { mode, ok: created, gagal: errors.length },
  });
  return NextResponse.json({ ok: created, gagal: errors.length, errors });
}
