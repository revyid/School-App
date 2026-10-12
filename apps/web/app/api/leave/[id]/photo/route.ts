// GET /api/leave/[id]/photo?which=siswa|ortu — stream foto bukti izin.
//
// Route ini ADA karena klien (guru/izin + siswa/izin) memanggil
// /api/leave/<id>/photo?which=siswa. Sebelumnya rute ini tidak ada sehingga
// setiap <img src="…/photo…"> berujung 404 (foto bukti "broken").
// Otorisasi + audit baca tetap sama seperti implementasi lama.
import { stat, readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { leavePhotoPath } from "@/server/leave-photos";
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

async function scopeOk(
  schoolId: string,
  role: string,
  userId: string,
  studentId: string,
  classIdOf?: string | null,
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role === "SISWA") return studentId === userId;
  // GURU: wali kelas / pengajar kelas siswa tersebut.
  const mine = await guruClassIds(schoolId, userId);
  if (classIdOf) return mine.has(classIdOf);
  const p = await runAsSchool(db, schoolId, (tx) =>
    tx.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } }));
  return !!p?.classId && mine.has(p.classId);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const which = new URL(req.url).searchParams.get("which") === "ortu" ? "parentPhoto" : "studentPhoto";
  const lr = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.findUnique({
      where: { id: id.slice(0, 64) },
      include: { student: { select: { studentProfile: { select: { classId: true } } } } },
    }));
  if (!lr) return NextResponse.json({ error: "pengajuan tidak ditemukan" }, { status: 404 });
  if (!(await scopeOk(a.school.id, a.role, a.userId, lr.studentId, lr.student.studentProfile?.classId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const name = which === "parentPhoto" ? lr.parentPhoto : lr.studentPhoto;
  // Fallback: bila foto yang diminta tidak ada, pakai foto lainnya (satu frame
  // siswa + ortu), supaya guru tetap melihat bukti walau kolom DB-nya beda.
  const fallback = which === "parentPhoto" ? lr.studentPhoto : lr.parentPhoto;
  const pick = name || fallback;
  if (!pick) return NextResponse.json({ error: "foto tidak ada" }, { status: 404 });
  let abs: string;
  try {
    abs = leavePhotoPath(a.school.id, pick);
  } catch {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }
  let st;
  try {
    st = await stat(abs);
  } catch {
    return NextResponse.json({ error: "file tidak ditemukan" }, { status: 404 });
  }
  const buf = await readFile(abs);
  await logAuth(a.school.id, "LEAVE.PHOTO_ACCESS", { actorId: a.userId, meta: { id: lr.id, which } });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": pick.endsWith(".png") ? "image/png" : "image/jpeg",
      "content-length": String(st.size),
      "content-disposition": `inline; filename="foto-izin-${lr.id.slice(0, 8)}${pick.endsWith(".png") ? ".png" : ".jpg"}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
