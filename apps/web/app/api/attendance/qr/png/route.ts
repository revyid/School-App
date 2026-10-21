import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import QRCode from "qrcode";
import { guruClassIds } from "@/server/lms-scope";

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

// GET /api/attendance/qr/png?studentId= — gambar QR (PNG dataURL) untuk kartu/cetak.
// Otorisasi sama dengan /api/attendance/qr (tanpa membuat token baru bila belum ada:
// token dibuat dulu via endpoint JSON).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const studentId = ((new URL(req.url).searchParams.get("studentId") ?? "") || a.userId).slice(0, 64);
  if (a.role === "SISWA" && studentId !== a.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const qr = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentQr.findUnique({ where: { studentId } }),
  );
  if (!qr) return NextResponse.json({ error: "token belum diterbitkan" }, { status: 404 });
  if (a.role === "GURU") {
    const target = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findFirst({
        where: { id: studentId, role: "SISWA" },
        select: { studentProfile: { select: { classId: true } } },
      }),
    );
    const ids = await guruClassIds(a.school.id, a.userId);
    const cid = target?.studentProfile?.classId;
    if (!cid || !ids.has(cid)) return NextResponse.json({ error: "bukan siswa kelas Anda" }, { status: 403 });
  }
  const png = await QRCode.toDataURL(qr.token, { width: 256, margin: 1 });
  const buf = Buffer.from(png.split(",")[1], "base64");
  return new NextResponse(buf, {
    headers: {
      "content-type": "image/png",
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
