import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiGate } from "@/server/api-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { timetableSlotSchema } from "@sms/shared/master";
import { siswaClassId } from "@/server/lms-scope";
import { validateSlotRefs } from "@/server/timetable-subjects";

// GET /api/timetable?classId= — ADMIN/GURU bebas; SISWA hanya kelasnya sendiri
// (tanpa classId = default kelas sendiri; classId lain → 403).
export async function GET(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const classParam = (new URL(req.url).searchParams.get("classId") ?? "").slice(0, 64);
  const teacherParam = (new URL(req.url).searchParams.get("teacherId") ?? "").slice(0, 64);
  const scope = (new URL(req.url).searchParams.get("scope") ?? "").slice(0, 16);

  if (a.role === "SISWA") {
    const mine = await siswaClassId(a.school.id, a.userId);
    if (!mine) return NextResponse.json({ rows: [] });
    if (classParam && classParam !== mine) {
      return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    }
    const classId = classParam || mine;
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

  // GURU / ADMIN — scope=all hanya ADMIN.
  if (scope === "all") {
    if (a.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.timetableSlot.findMany({
        include: {
          subjectRef: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true } },
          class: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { class: { name: "asc" } }, { startTime: "asc" }],
        take: 2000,
      }),
    );
    return NextResponse.json({
      rows: rows.map((s) => ({
        id: s.id, classId: s.classId, className: s.class.name,
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
        subjectName: s.subjectRef?.name ?? s.subjectName ?? null,
        teacherName: s.teacher?.name ?? null,
      })),
    });
  }
  const where: { classId?: string; teacherId?: string } = {};
  if (classParam) where.classId = classParam;
  if (teacherParam === "me") {
    where.teacherId = a.userId;
  } else if (teacherParam) {
    where.teacherId = teacherParam;
  }

  if (!where.classId && !where.teacherId && a.role !== "ADMIN") {
    return NextResponse.json({ error: "classId atau filter guru diperlukan" }, { status: 400 });
  }

  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where,
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
  const a = await apiGate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = timetableSlotSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues }, { status: 400 });
  const d = body.data;
  const v = await validateSlotRefs(a.school.id, d);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
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
  const a = await apiGate(req, ["ADMIN"]);
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
  const a = await apiGate(req, ["ADMIN"]);
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

const patchSchema = timetableSlotSchema.extend({ id: z.string().min(1).max(64) });

// PATCH /api/timetable — ADMIN: ubah satu slot (validasi relasi sama dengan POST).
export async function PATCH(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues }, { status: 400 });
  const d = body.data;
  const cur = await runAsSchool(db, a.school.id, (tx) => tx.timetableSlot.findUnique({ where: { id: d.id } }));
  if (!cur) return NextResponse.json({ error: "slot tidak ditemukan" }, { status: 404 });
  const v = await validateSlotRefs(a.school.id, d);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.update({
      where: { id: d.id },
      data: {
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
  await logAuth(a.school.id, "TIMETABLE.UPDATE", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ row });
}
