import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { parseDay } from "@sms/shared/attendance";

const batchSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(365),
  kind: z.enum(["LIBUR", "EFEKTIF"]),
  note: z.string().trim().max(280).optional().nullable(),
  classId: z.string().min(1).max(64).optional().nullable(),
});

// POST /api/attendance/calendar/batch — ADMIN: tambah banyak hari sekaligus
// (UI kirim array tanggal hasil expand dari–sampai). Upsert idempoten.
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
  const body = batchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid (maks 365 tanggal)" }, { status: 400 });
  const days = body.data.dates.map(parseDay).filter((d): d is Date => !!d);
  if (days.length === 0) return NextResponse.json({ error: "tidak ada tanggal valid" }, { status: 400 });
  if (body.data.classId) {
    const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId! } }));
    if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  }
  let ok = 0;
  await runAsSchool(db, a.school.id, async (tx) => {
    for (const day of days) {
      const cond = body.data.classId
        ? { schoolId: a.school.id, date: day, classId: body.data.classId }
        : { schoolId: a.school.id, date: day, classId: null };
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
            classId: body.data.classId ?? null, note: body.data.note ?? null,
          },
        });
      }
      ok++;
    }
  });
  await logAuth(a.school.id, "CALENDAR.BATCH", {
    actorId: a.userId, meta: { ok, kind: body.data.kind },
  });
  return NextResponse.json({ ok }, { status: 201 });
}
