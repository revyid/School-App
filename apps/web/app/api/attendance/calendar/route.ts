import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { calendarSchema, parseDay } from "@sms/shared/attendance";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/attendance/calendar?month=YYYY-MM — daftar hari khusus bulan itu.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const month = (new URL(req.url).searchParams.get("month") ?? "").slice(0, 7);
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return NextResponse.json({ error: "month format YYYY-MM" }, { status: 400 });
  const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.academicCalendar.findMany({
      where: { date: { gte: from, lt: to } },
      include: { class: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
      take: 200,
    }),
  );
  return NextResponse.json({ rows });
}

// POST /api/attendance/calendar — ADMIN saja (upsert per tanggal+kelas).
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = calendarSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const day = parseDay(body.data.date);
  if (!day) return NextResponse.json({ error: "tanggal tidak valid" }, { status: 400 });
  if (body.data.classId) {
    const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId! } }));
    if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  }
  try {
    const cond = body.data.classId
      ? { schoolId: a.school.id, date: day, classId: body.data.classId }
      : { schoolId: a.school.id, date: day, classId: null };
    const prev = await runAsSchool(db, a.school.id, (tx) =>
      tx.academicCalendar.findFirst({ where: cond }),
    );
    const row = prev
      ? await runAsSchool(db, a.school.id, (tx) =>
          tx.academicCalendar.update({
            where: { id: prev.id },
            data: { kind: body.data.kind, note: body.data.note ?? null },
          }),
        )
      : await runAsSchool(db, a.school.id, (tx) =>
          tx.academicCalendar.create({
            data: {
              schoolId: a.school.id, date: day, kind: body.data.kind,
              classId: body.data.classId ?? null, note: body.data.note ?? null,
            },
          }),
        );
    await logAuth(a.school.id, "CALENDAR.UPSERT", { actorId: a.userId, meta: { id: row.id } });
    return NextResponse.json({ row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "gagal menyimpan kalender" }, { status: 409 });
  }
}

// DELETE /api/attendance/calendar?id= — ADMIN saja.
export async function DELETE(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const id = (new URL(req.url).searchParams.get("id") ?? "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.academicCalendar.delete({ where: { id } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "CALENDAR.DELETE", { actorId: a.userId, meta: { id } });
  return NextResponse.json({ ok: true });
}
