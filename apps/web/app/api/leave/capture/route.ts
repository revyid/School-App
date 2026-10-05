import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { CAPTURE_TTL_SEC } from "@sms/shared/leave";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SISWA"],
  });
}

// POST /api/leave/capture — minta token capture (terikat siswa ini, TTL 5 mnt).
// Syarat: parental consent sudah disetujui. Rate limit ketat (10/jam).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:capture:${a.school.id}:${a.userId}`, 10, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });

  const consent = await runAsSchool(db, a.school.id, (tx) =>
    tx.parentalConsent.findUnique({ where: { studentId: a.userId } }));
  if (!consent?.consented) {
    return NextResponse.json({ error: "Izin orang tua belum disetujui — hubungi admin" }, { status: 403 });
  }
  const token = randomBytes(16).toString("hex");
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.captureSession.create({
      data: {
        schoolId: a.school.id,
        studentId: a.userId,
        token,
        expiresAt: new Date(Date.now() + CAPTURE_TTL_SEC * 1000),
      },
    }));
  return NextResponse.json({ token: row.token, expiresAt: row.expiresAt }, { status: 201 });
}
