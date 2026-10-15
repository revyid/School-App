import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { materialSchema } from "@sms/shared/lms";
import { guruClassIds } from "@/server/lms-scope";
import { saveFileBuffer, saveFileStream } from "@/server/files";
import { logAuth } from "@/server/audit";
import { canManageTask } from "@/server/task-helpers";

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

// GET /api/tasks/[id]/materials — materi (siswa hanya bila sudah publish).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, publishAt: true, status: true, targets: { select: { classId: true } } },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const now = new Date();
  if (a.role === "SISWA") {
    const p = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (t.classId !== p?.classId && !t.targets.some((x) => x.classId === p?.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
    if (t.status !== "PUBLISHED" || t.publishAt.getTime() > now.getTime()) {
      return NextResponse.json({ error: "belum dipublikasikan" }, { status: 404 });
    }
  } else if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId) && !t.targets.some((x) => mine.has(x.classId))) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.findMany({ where: { taskId: t.id }, orderBy: { createdAt: "asc" }, take: 100 }));
  return NextResponse.json({ rows });
}

// POST /api/tasks/[id]/materials — GURU/ADMIN tambah materi (T2).
// multipart {kind: FILE|IMAGE|VIDEO, file, isMain, isExample, categoryId?}
// atau JSON {kind: TEXT, text, isMain, isExample, categoryId?}.
// Video hingga 50MB (D6) — streaming ke disk.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const taskId = id.slice(0, 64);
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: taskId }, select: { id: true, classId: true, authorId: true, targets: { select: { classId: true } } } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
    const kind = String(form.get("kind") ?? "");
    if (kind !== "FILE" && kind !== "IMAGE" && kind !== "VIDEO") {
      return NextResponse.json({ error: "kind harus FILE/IMAGE/VIDEO" }, { status: 400 });
    }
    const f = form.get("file");
    if (!f || typeof f === "string") return NextResponse.json({ error: "file wajib ada" }, { status: 400 });
    const isMain = form.get("isMain") === "1" || form.get("isMain") === "true";
    const isExample = form.get("isExample") === "1" || form.get("isExample") === "true";
    const categoryId = String(form.get("categoryId") ?? "").slice(0, 64) || null;
    // Contoh menempel di kategorinya (T3): validasi milik tugas ini.
    if (categoryId) {
      const cat = await runAsSchool(db, a.school.id, (tx) =>
        tx.taskCategory.findUnique({ where: { id: categoryId }, select: { taskId: true } }));
      if (!cat || cat.taskId !== t.id) return NextResponse.json({ error: "kategori tidak valid" }, { status: 400 });
    }
    try {
      const purpose =
        kind === "VIDEO" ? ("video-material" as const)
        : kind === "IMAGE" ? ("image" as const)
        : ("doc" as const);
      const saved =
        kind === "VIDEO" && f.size > 8 * 1024 * 1024
          ? await saveFileStream([a.school.id, "tasks", taskId], f.stream() as unknown as ReadableStream<Uint8Array>, purpose, f.name || "video")
          : await saveFileBuffer([a.school.id, "tasks", taskId], Buffer.from(await f.arrayBuffer()), purpose, f.name || "file");
      const row = await runAsSchool(db, a.school.id, (tx) =>
        tx.taskMaterial.create({
          data: { schoolId: a.school.id, taskId, kind, fileName: saved.fileName, mime: saved.mime, size: saved.size, isMain, isExample, categoryId },
        }));
      await logAuth(a.school.id, "TASK.MATERIAL_ADD", { actorId: a.userId, meta: { taskId, kind } });
      return NextResponse.json({ material: row }, { status: 201 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  const body = materialSchema.safeParse(await req.json().catch(() => null));
  if (!body.success || body.data.kind !== "TEXT" || !body.data.text) {
    return NextResponse.json({ error: "materi teks wajib ada" }, { status: 400 });
  }
  if (body.data.categoryId) {
    const cat = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskCategory.findUnique({ where: { id: body.data.categoryId! }, select: { taskId: true } }));
    if (!cat || cat.taskId !== t.id) return NextResponse.json({ error: "kategori tidak valid" }, { status: 400 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskMaterial.create({
      data: {
        schoolId: a.school.id, taskId, kind: "TEXT", text: body.data.text,
        isMain: body.data.isMain ?? false, isExample: body.data.isExample ?? false,
        categoryId: body.data.categoryId ?? null,
      },
    }));
  await logAuth(a.school.id, "TASK.MATERIAL_ADD", { actorId: a.userId, meta: { taskId } });
  return NextResponse.json({ material: row }, { status: 201 });
}
