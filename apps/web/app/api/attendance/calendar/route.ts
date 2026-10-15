import { NextRequest, NextResponse } from "next/server";
import { apiGate } from "@/server/api-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { calendarSchema, parseDay } from "@sms/shared/attendance";

// GET /api/attendance/calendar[?month=YYYY-MM][?scope=semua|kelas:<id>|tingkat:<lvl>]
// Tanpa month: daftar mendatang (hari ini ke depan, maks 200). Month tetap didukung untuk kompatibilitas.
export async function GET(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const sp = new URL(req.url).searchParams;
  const scope = (sp.get("scope") ?? "semua").slice(0, 96);
  const month = (sp.get("month") ?? "").slice(0, 7);
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  let where: Record<string, unknown>;
  if (m) {
    const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
    const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
    where = { date: { gte: from, lt: to } };
  } else {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    where = { date: { gte: today } };
  }
  if (scope.startsWith("kelas:")) {
    where = { ...where, classId: scope.slice(6) };
  } else if (scope.startsWith("tingkat:")) {
    const lvl = scope.slice(8);
    const list = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { gradeLevel: lvl }, select: { id: true } }));
    where = { ...where, classId: { in: list.map((c) => c.id) } };
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.academicCalendar.findMany({
      where,
      include: { class: { select: { id: true, name: true, gradeLevel: true } } },
      orderBy: { date: "asc" },
      take: 200,
    }),
  );
  return NextResponse.json({ rows });
}

// POST /api/attendance/calendar — ADMIN saja (upsert per tanggal+kelas).
export async function POST(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN"]);
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
  const a = await apiGate(req, ["ADMIN"]);
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
