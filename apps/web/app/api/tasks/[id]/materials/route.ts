import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { materialSchema } from "@sms/shared/lms";
import { guruClassIds } from "@/server/lms-scope";
import { saveTaskFile } from "@/server/task-files";
import { logAuth } from "@/server/audit";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/tasks/[id]/materials — materi pendukung (siswa hanya bila sudah publish).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, publishAt: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const now = new Date();
  if (a.role === "SISWA") {
    const p = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (t.classId !== p?.classId) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (t.publishAt.getTime() > now.getTime()) return NextResponse.json({ error: "belum dipublikasikan" }, { status: 404 });
  } else if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.findMany({ where: { taskId: t.id }, orderBy: { createdAt: "asc" }, take: 100 }));
  return NextResponse.json({ rows: rows.map((m) => ({ ...m, text: m.kind === "TEXT" ? m.text : undefined })) });
}

// POST /api/tasks/[id]/materials — GURU/ADMIN tambah materi.
// JSON {kind:TEXT, text} atau multipart {kind:FILE|IMAGE, file}.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const taskId = id.slice(0, 64);
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: taskId }, select: { id: true, classId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
    const kind = String(form.get("kind") ?? "");
    if (kind !== "FILE" && kind !== "IMAGE") return NextResponse.json({ error: "kind harus FILE/IMAGE" }, { status: 400 });
    const f = form.get("file");
    if (!f || typeof f === "string") return NextResponse.json({ error: "file wajib ada" }, { status: 400 });
    const buf = Buffer.from(await f.arrayBuffer());
    let saved;
    try {
      saved = await saveTaskFile(a.school.id, taskId, f.name || "file", buf);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskMaterial.create({
        data: { schoolId: a.school.id, taskId, kind, fileName: saved.fileName, mime: saved.mime, size: saved.size },
      }));
    await logAuth(a.school.id, "TASK.MATERIAL_ADD", { actorId: a.userId, meta: { taskId } });
    return NextResponse.json({ material: row }, { status: 201 });
  }
  const body = materialSchema.safeParse(await req.json().catch(() => null));
  if (!body.success || body.data.kind !== "TEXT" || !body.data.text) {
    return NextResponse.json({ error: "materi teks wajib ada" }, { status: 400 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.create({
      data: { schoolId: a.school.id, taskId, kind: "TEXT", text: body.data.text },
    }));
  await logAuth(a.school.id, "TASK.MATERIAL_ADD", { actorId: a.userId, meta: { taskId } });
  return NextResponse.json({ material: row }, { status: 201 });
}
