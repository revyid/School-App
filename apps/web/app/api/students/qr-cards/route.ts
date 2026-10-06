import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// GET /api/students/qr-cards?classId= — Ambil semua data siswa & token QR untuk kartu/download ZIP
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId")?.slice(0, 64) || undefined;

  const students = await runAsSchool(db, a.school.id, async (tx) => {
    return tx.studentProfile.findMany({
      where: {
        schoolId: a.school.id,
        ...(classId ? { classId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, nisn: true, isActive: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
    });
  });

  // Pastikan tiap siswa memiliki studentQr token (buat jika belum ada)
  const rows = await runAsSchool(db, a.school.id, async (tx) => {
    const list: {
      studentId: string;
      name: string;
      nisn: string;
      className: string;
      qrToken: string;
    }[] = [];

    for (const s of students) {
      if (!s.user || !s.user.isActive) continue;
      let qr = await tx.studentQr.findUnique({ where: { studentId: s.userId } });
      if (!qr) {
        qr = await tx.studentQr.create({
          data: {
            schoolId: a.school.id,
            studentId: s.userId,
            token: `sms1-${randomBytes(16).toString("hex")}`,
          },
        });
      }
      list.push({
        studentId: s.userId,
        name: s.user.name,
        nisn: s.user.nisn ?? "-",
        className: s.class?.name ?? "Umum",
        qrToken: qr.token,
      });
    }
    return list;
  });

  return NextResponse.json({
    schoolName: a.school.name,
    total: rows.length,
    rows,
  });
}
