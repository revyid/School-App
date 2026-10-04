import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import QRCode from "qrcode";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
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
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }));
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }));
    const ids = new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)]);
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
