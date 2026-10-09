import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { resolveDefaultPassword } from "@/server/password";
import { studentCreateSchema, normalizePhone } from "@sms/shared/master";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
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

// POST /api/students/single — Tambah siswa tunggal 1 per 1
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const rl = await hit(`rl:student:create:${a.school.id}`, 60, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering menambah siswa, coba lagi nanti" }, { status: 429 });

  const body = studentCreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Data siswa tidak lengkap / tidak valid" }, { status: 400 });

  const { password: pw } = await resolveDefaultPassword(a.school.id, body.data.nisn);
  const hash = await argon2.hash(pw, { type: argon2.argon2id });

  try {
    const result = await runAsSchool(db, a.school.id, async (tx) => {
      // Cek NISN sudah dipakai di sekolah ini
      const existing = await tx.user.findFirst({
        where: { schoolId: a.school.id, nisn: body.data.nisn },
      });
      if (existing) throw new Error("NISN sudah terdaftar");

      // Buat Akun Siswa
      const u = await tx.user.create({
        data: {
          schoolId: a.school.id,
          role: "SISWA",
          name: body.data.name,
          nisn: body.data.nisn,
          passwordHash: hash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
        },
      });

      // Buat Profil Siswa
      await tx.studentProfile.create({
        data: {
          schoolId: a.school.id,
          userId: u.id,
          classId: body.data.classId || null,
          parentPhone: normalizePhone(body.data.parentPhone),
          gender: body.data.gender || null,
        },
      });

      // Buat QR Token Presensi
      await tx.studentQr.create({
        data: {
          schoolId: a.school.id,
          studentId: u.id,
          token: `sms1-${randomBytes(16).toString("hex")}`,
        },
      });

      return u;
    });

    await logAuth(a.school.id, "STUDENT.CREATE", { actorId: a.userId, ip: ip(req), meta: { studentId: result.id } });
    return NextResponse.json({ row: result, tempPassword: pw }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Gagal menambah siswa" }, { status: 409 });
  }
}
