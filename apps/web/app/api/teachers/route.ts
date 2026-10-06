import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { teacherCreateSchema, teacherPatchSchema, paginationSchema } from "@sms/shared/master";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
}

export async function GET(req: NextRequest) {
  const a = await gate(req);
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
        taughtClasses: {
          select: {
            id: true,
            subject: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  );
  const total = await runAsSchool(db, a.school.id, (tx) => tx.user.count({ where }));
  return NextResponse.json({ rows, page, perPage, total });
}

export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:teacher:${a.school.id}`, 30, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu banyak, coba lagi nanti" }, { status: 429 });
  const body = teacherCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const pw = randomBytes(9).toString("base64url");
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

    // Tetapkan penugasan mapel jika dipilih
    if (body.data.subject && body.data.subjectClassId) {
      await runAsSchool(db, a.school.id, (tx) =>
        tx.teacherClass.create({
          data: {
            schoolId: a.school.id,
            teacherId: row.id,
            classId: body.data.subjectClassId!,
            subject: body.data.subject!,
          },
        }),
      ).catch(() => {});
    }

    await logAuth(a.school.id, "TEACHER.CREATE", { actorId: a.userId, ip: ip(req), meta: { userId: row.id } });
    return NextResponse.json({ row: { id: row.id, name: row.name, email: row.email }, tempPassword: pw }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "email/nisn sudah dipakai" }, { status: 409 });
  }
}
