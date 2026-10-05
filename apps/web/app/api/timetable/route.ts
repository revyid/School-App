import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { timetableSlotSchema } from "@sms/shared/master";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// GET /api/timetable?classId= — ADMIN/GURU.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const classId = (new URL(req.url).searchParams.get("classId") ?? "").slice(0, 64);
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where: { classId },
      include: {
        subjectRef: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 500,
    }),
  );
  return NextResponse.json({ rows });
}

// POST /api/timetable — ADMIN: tambah slot (validasi relasi se-sekolah).
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = timetableSlotSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues }, { status: 400 });
  const d = body.data;
  const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: d.classId } }));
  if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  if (d.subjectId) {
    const s = await runAsSchool(db, a.school.id, (tx) => tx.subject.findUnique({ where: { id: d.subjectId! } }));
    if (!s) return NextResponse.json({ error: "mapel tidak ditemukan" }, { status: 400 });
  }
  if (d.teacherId) {
    const t = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findFirst({ where: { id: d.teacherId!, role: "GURU" } }),
    );
    if (!t) return NextResponse.json({ error: "guru tidak ditemukan" }, { status: 400 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.create({
      data: {
        schoolId: a.school.id,
        classId: d.classId,
        subjectId: d.subjectId ?? null,
        subjectName: d.subjectName || d.subjectId || "",
        teacherId: d.teacherId ?? null,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
      },
    }),
  );
  await logAuth(a.school.id, "TIMETABLE.CREATE", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ row }, { status: 201 });
}

// DELETE /api/timetable?id= — ADMIN.
export async function DELETE(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const id = (new URL(req.url).searchParams.get("id") ?? "").slice(0, 64);
  if (!id) return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.timetableSlot.delete({ where: { id } }));
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await logAuth(a.school.id, "TIMETABLE.DELETE", { actorId: a.userId, meta: { id } });
  return NextResponse.json({ ok: true });
}

import { timetableSlotInputSchema } from "@sms/shared/master";

export const bulkSchema = z.object({
  classId: z.string().min(1).max(64),
  slots: z.array(timetableSlotInputSchema).max(100),
});

// PUT /api/timetable — ADMIN: ganti seluruh jadwal satu kelas (idempotent).
export async function PUT(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const cls = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId } }));
  if (!cls) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  await runAsSchool(
    db,
    a.school.id,
    (tx) =>
      tx.$transaction([
        tx.timetableSlot.deleteMany({ where: { classId: body.data.classId } }),
        ...body.data.slots.map((s) =>
          tx.timetableSlot.create({
            data: {
              schoolId: a.school.id,
              classId: body.data.classId,
              subjectId: s.subjectId ?? null,
              subjectName: s.subjectName || s.subjectId || "",
              teacherId: s.teacherId ?? null,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            },
          }),
        ),
      ]),
    { timeout: 30_000 },
  );
  await logAuth(a.school.id, "TIMETABLE.REPLACE", { actorId: a.userId, meta: { classId: body.data.classId } });
  return NextResponse.json({ ok: true });
}
