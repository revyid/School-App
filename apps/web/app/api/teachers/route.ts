import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { resolveDefaultPassword } from "@/server/password";
import { teacherCreateSchema, teacherPatchSchema, paginationSchema } from "@sms/shared/master";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[] = ["ADMIN"]) {
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

export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const p = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    perPage: url.searchParams.get("perPage") ?? undefined,
    q: url.searchParams.get("q") ?? "",
  });
  if (!p.success) return NextResponse.json({ error: "parameter tidak valid" }, { status: 400 });
  const { page, perPage, q } = p.data;
  const where = {
    role: "GURU" as const,
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
      : {}),
  };
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        homeroomOf: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  );
  // Penugasan guru dibaca LIVE dari TimetableSlot (shared data, tanpa tabel cache):
  // distinct (teacherId, classId) + mapel tersering per pasangan.
  const teacherIds = rows.map((r) => r.id);
  const slots = teacherIds.length > 0 ? await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where: { teacherId: { in: teacherIds } },
      include: {
        class: { select: { id: true, name: true } },
        subjectRef: { select: { name: true } },
      },
      take: 5000,
    })) : [];
  const taughtByTeacher = new Map<string, { teacherId: string; classId: string; subject: string | null; class: { id: string; name: string } }[]>();
  {
    const groups = new Map<string, { teacherId: string; classId: string; className: string; names: Map<string, number> }>();
    for (const s of slots) {
      if (!s.teacherId) continue;
      const key = `${s.teacherId}${s.classId}`;
      let g = groups.get(key);
      if (!g) {
        g = { teacherId: s.teacherId, classId: s.classId, className: s.class.name, names: new Map() };
        groups.set(key, g);
      }
      const nm = (s.subjectRef?.name ?? s.subjectName ?? "").trim();
      if (nm) g.names.set(nm, (g.names.get(nm) ?? 0) + 1);
    }
    for (const g of groups.values()) {
      const top = [...g.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      const list = taughtByTeacher.get(g.teacherId) ?? [];
      list.push({ teacherId: g.teacherId, classId: g.classId, subject: top, class: { id: g.classId, name: g.className } });
      taughtByTeacher.set(g.teacherId, list);
    }
  }
  const total = await runAsSchool(db, a.school.id, (tx) => tx.user.count({ where }));
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, taughtFromSlots: taughtByTeacher.get(r.id) ?? [] })),
    page, perPage, total,
  });
}

export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:teacher:${a.school.id}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu banyak, coba lagi nanti" }, { status: 429 });
  const body = teacherCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const { password: pw } = await resolveDefaultPassword(a.school.id, body.data.nisn);
  try {
    const row = await runAsSchool(
      db,
      a.school.id,
      (tx) =>
        tx.user.create({
          data: {
            schoolId: a.school.id,
            role: "GURU",
            email: body.data.email.toLowerCase(),
            nisn: body.data.nisn || null,
            name: body.data.name,
            passwordHash: "",
            mustChangePassword: true,
            passwordChangedAt: new Date(),
          },
        }),
      { timeout: 15_000 },
    );
    const hash = await argon2.hash(pw, { type: argon2.argon2id });
    await runAsSchool(db, a.school.id, (tx) =>
      tx.user.update({ where: { id: row.id }, data: { passwordHash: hash } }),
    );

    // Tetapkan wali kelas jika dipilih
    if (body.data.homeroomClassId) {
      await runAsSchool(db, a.school.id, (tx) =>
        tx.class.update({
          where: { id: body.data.homeroomClassId! },
          data: { homeroomTeacherId: row.id },
        }),
      ).catch(() => {});
    }

    // Penugasan mapel TIDAK dibuat di sini — atur lewat jadwal
    // (/admin/jadwal): slot dengan teacherId guru ini otomatis tampil di profilnya.

    await logAuth(a.school.id, "TEACHER.CREATE", { actorId: a.userId, ip: ip(req), meta: { userId: row.id } });
    return NextResponse.json({ row: { id: row.id, name: row.name, email: row.email }, tempPassword: pw }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "email/nisn sudah dipakai" }, { status: 409 });
  }
}
