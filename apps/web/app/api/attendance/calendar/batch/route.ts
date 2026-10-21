import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { parseDay } from "@lacakedu/shared/attendance";

async function gateAdmin(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
}

const batchSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(365),
  kind: z.enum(["LIBUR", "EFEKTIF"]),
  note: z.string().trim().max(280).optional().nullable(),
  // Scope: salah satu — semua (keduanya kosong), satu kelas, atau satu tingkatan.
  classId: z.string().min(1).max(64).optional().nullable(),
  gradeLevel: z.string().trim().max(32).optional().nullable(),
});

// POST /api/attendance/calendar/batch — ADMIN: tambah banyak hari sekaligus
// (UI kirim array tanggal hasil expand dari–sampai). Upsert idempoten.
// Scope: semua kelas (classId kosong) | satu kelas | satu tingkatan (expand ke kelas-kelasnya).
export async function POST(req: NextRequest) {
  const a = await gateAdmin(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = batchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid (maks 365 tanggal)" }, { status: 400 });
  const days = body.data.dates.map(parseDay).filter((d): d is Date => !!d);
  if (days.length === 0) return NextResponse.json({ error: "tidak ada tanggal valid" }, { status: 400 });

  // Resolve scope → daftar classId target (null = global semua kelas).
  let targets: (string | null)[] = [null];
  if (body.data.classId) {
    const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId! } }));
    if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
    targets = [c.id];
  } else if (body.data.gradeLevel) {
    const list = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { gradeLevel: body.data.gradeLevel! }, select: { id: true } }));
    if (list.length === 0) return NextResponse.json({ error: "tingkatan tidak punya kelas" }, { status: 400 });
    targets = list.map((c) => c.id);
  }

  let ok = 0;
  await runAsSchool(db, a.school.id, async (tx) => {
    for (const day of days) {
      for (const cid of targets) {
        const cond = cid ? { schoolId: a.school.id, date: day, classId: cid } : { schoolId: a.school.id, date: day, classId: null };
        const prev = await tx.academicCalendar.findFirst({ where: cond });
        if (prev) {
          await tx.academicCalendar.update({
            where: { id: prev.id },
            data: { kind: body.data.kind, note: body.data.note ?? null },
          });
        } else {
          await tx.academicCalendar.create({
            data: {
              schoolId: a.school.id, date: day, kind: body.data.kind,
              classId: cid, note: body.data.note ?? null,
            },
          });
        }
        ok++;
      }
    }
  });
  await logAuth(a.school.id, "CALENDAR.BATCH", {
    actorId: a.userId, meta: { ok, kind: body.data.kind, scope: body.data.classId ?? body.data.gradeLevel ?? "semua" },
  });
  return NextResponse.json({ ok }, { status: 201 });
}

const deleteManySchema = z.object({
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
});

// DELETE /api/attendance/calendar/batch {ids} — ADMIN: hapus banyak sekaligus.
export async function DELETE(req: NextRequest) {
  const a = await gateAdmin(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = deleteManySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid (maks 500 id)" }, { status: 400 });
  const r = await runAsSchool(db, a.school.id, (tx) =>
    tx.academicCalendar.deleteMany({ where: { id: { in: body.data.ids } } }));
  await logAuth(a.school.id, "CALENDAR.DELETE_MANY", { actorId: a.userId, meta: { count: r.count } });
  return NextResponse.json({ ok: r.count });
}
