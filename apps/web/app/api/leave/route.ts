import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { leaveInputSchema, leaveDay } from "@sms/shared/leave";
import { saveLeavePhoto, deleteLeavePhoto } from "@/server/leave-photos";
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

// GET /api/leave — daftar pengajuan.
// SISWA: miliknya. GURU: siswa kelasnya (PENDING dulu). ADMIN: semua (filter ?status=).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: { studentId?: string; status?: "PENDING" | "APPROVED" | "REJECTED" } = {};
  if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") where.status = status;

  if (a.role === "SISWA") {
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.leaveRequest.findMany({
        where: { studentId: a.userId, ...where },
        orderBy: { date: "desc" },
        take: 100,
      }));
    return NextResponse.json({ rows: rows.map((r) => ({ ...r, studentPhoto: undefined, parentPhoto: undefined, hasPhoto: !!(r.studentPhoto || r.parentPhoto) })) });
  }
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (mine.size === 0) return NextResponse.json({ rows: [] });
    const profiles = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findMany({ where: { classId: { in: [...mine] } }, select: { userId: true }, take: 2000 }));
    const ids = profiles.map((p) => p.userId);
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.leaveRequest.findMany({
        where: { studentId: { in: ids }, ...where },
        include: { student: { select: { id: true, name: true } } },
        orderBy: [{ status: "asc" }, { date: "desc" }],
        take: 200,
      }));
    return NextResponse.json({ rows: rows.map((r) => ({ ...r, studentPhoto: undefined, parentPhoto: undefined, hasPhoto: !!(r.studentPhoto || r.parentPhoto) })) });
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.findMany({
      where,
      include: { student: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { date: "desc" }],
      take: 200,
    }));
  return NextResponse.json({ rows: rows.map((r) => ({ ...r, studentPhoto: undefined, parentPhoto: undefined, hasPhoto: !!(r.studentPhoto || r.parentPhoto) })) });
}

// POST /api/leave — SISWA ajukan (multipart: date, kind, description, captureToken, studentPhoto, parentPhoto?).
// Server: validasi token (miliknya, belum dipakai, belum kedaluwarsa) -> tandai usedAt,
// simpan foto via saveLeavePhoto, upsert LeaveRequest (PENDING boleh direvisi).
// Upload galeri diblokir di UI; server menolak tanpa capture token valid.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:leave:${a.school.id}:${a.userId}`, 20, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });

  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.includes("multipart/form-data")) {
    return NextResponse.json({ error: "gunakan form kamera (bukan JSON)" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
  const parsed = leaveInputSchema.safeParse({
    date: String(form.get("date") ?? ""),
    kind: String(form.get("kind") ?? ""),
    description: String(form.get("description") ?? ""),
  });
  if (!parsed.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const day = leaveDay(parsed.data.date);
  if (!day) return NextResponse.json({ error: "tanggal tidak valid" }, { status: 400 });

  const token = String(form.get("captureToken") ?? "");
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return NextResponse.json({ error: "capture token tidak valid — ambil dulu via kamera" }, { status: 400 });
  }
  const sess = await runAsSchool(db, a.school.id, (tx) =>
    tx.captureSession.findUnique({ where: { token } }));
  if (!sess || sess.studentId !== a.userId) {
    return NextResponse.json({ error: "capture token bukan milik Anda" }, { status: 403 });
  }
  if (sess.usedAt) {
    return NextResponse.json({ error: "capture token sudah dipakai" }, { status: 410 });
  }
  if (sess.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "capture token kedaluwarsa — ambil baru" }, { status: 410 });
  }

  const fSiswa = form.get("studentPhoto");
  if (!fSiswa || typeof fSiswa === "string") {
    return NextResponse.json({ error: "foto siswa (kamera) wajib ada" }, { status: 400 });
  }
  const bufSiswa = Buffer.from(await fSiswa.arrayBuffer());
  const fOrtu = form.get("parentPhoto");
  const bufOrtu = fOrtu && typeof fOrtu !== "string" ? Buffer.from(await fOrtu.arrayBuffer()) : null;

  let studentPhoto: string;
  try {
    studentPhoto = await saveLeavePhoto(a.school.id, "s", bufSiswa);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  let parentPhoto: string | null = null;
  if (bufOrtu) {
    try {
      parentPhoto = await saveLeavePhoto(a.school.id, "p", bufOrtu);
    } catch (e) {
      await deleteLeavePhoto(a.school.id, studentPhoto);
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  await runAsSchool(db, a.school.id, (tx) =>
    tx.captureSession.update({ where: { id: sess.id }, data: { usedAt: new Date() } }),
  );
  const now = new Date();
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.leaveRequest.upsert({
      where: { schoolId_studentId_date: { schoolId: a.school.id, studentId: a.userId, date: day } },
      update: {
        kind: parsed.data.kind, description: parsed.data.description,
        studentPhoto, parentPhoto, photographedAt: now,
        status: "PENDING", reviewerId: null, reviewNote: null, reviewedAt: null,
      },
      create: {
        schoolId: a.school.id, studentId: a.userId, date: day,
        kind: parsed.data.kind, description: parsed.data.description,
        studentPhoto, parentPhoto, photographedAt: now, status: "PENDING",
      },
    }));
  await logAuth(a.school.id, "LEAVE.SUBMIT", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ leave: { ...row, studentPhoto: undefined, parentPhoto: undefined, hasPhoto: true } }, { status: 201 });
}
