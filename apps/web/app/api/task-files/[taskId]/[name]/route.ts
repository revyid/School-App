import { stat, readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { taskFilePath } from "@/server/task-files";
import { guruClassIds } from "@/server/lms-scope";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host") ?? "";
  if (!origin) return true; // navigasi langsung / unduhan browser
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// GET /api/task-files/[taskId]/[name] — unduh file materi atau submission.
// - Materi: siswa sekelas (publish), guru kelasnya, admin.
// - Submission milik siswa lain: DITOLAK kecuali guru kelasnya / admin (untuk menilai).
export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string; name: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  if (!checkOrigin(req)) return NextResponse.json({ error: "origin tidak valid" }, { status: 403 });
  const { taskId, name } = await params;
  const fileName = name.slice(0, 120);
  if (fileName.includes("/") || fileName.includes("..")) {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: taskId.slice(0, 64) }, select: { id: true, classId: true, publishAt: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });

  const mat = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.findFirst({ where: { taskId: t.id, fileName } }));
  const sub = mat ? null : await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findFirst({ where: { taskId: t.id, fileName } }));
  if (!mat && !sub) return NextResponse.json({ error: "file tidak ditemukan" }, { status: 404 });

  // Otorisasi.
  if (a.role === "SISWA") {
    const p = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (t.classId !== p?.classId) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (mat && t.publishAt.getTime() > Date.now()) {
      return NextResponse.json({ error: "belum dipublikasikan" }, { status: 404 });
    }
    if (sub && sub.studentId !== a.userId) {
      return NextResponse.json({ error: "bukan pengumpulan Anda" }, { status: 403 });
    }
  } else if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }

  let abs: string;
  try {
    abs = taskFilePath(a.school.id, t.id, fileName);
  } catch {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }
  let st;
  try {
    st = await stat(abs);
  } catch {
    return NextResponse.json({ error: "file tidak ditemukan" }, { status: 404 });
  }
  const mime = (mat?.mime ?? sub?.mime ?? "application/octet-stream") as string;
  const buf = await readFile(abs);
  await logAuth(a.school.id, "TASK.FILE_ACCESS", { actorId: a.userId, meta: { taskId: t.id, fileName } });
  const body = new Uint8Array(buf);
  return new NextResponse(body, {
    headers: {
      "content-type": mime,
      "content-length": String(st.size),
      "content-disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
