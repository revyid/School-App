import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { submitSchema, canSubmit, isLateSubmit } from "@sms/shared/lms";
import { siswaClassId } from "@/server/lms-scope";
import { saveTaskFile } from "@/server/task-files";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["SISWA"],
  });
}

// POST /api/tasks/[id]/submit — SISWA kirim (teks/link via JSON, file via multipart).
// Upsert per (taskId, studentId): kirim ulang = update sebelum deadline (atau late bila allowLate).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const taskId = id.slice(0, 64);
  const rl = await hit(`rl:submit:${a.school.id}:${a.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });

  const t = await runAsSchool(db, a.school.id, (tx) => tx.task.findUnique({ where: { id: taskId } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const cid = await siswaClassId(a.school.id, a.userId);
  if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  const now = new Date();
  if (t.publishAt.getTime() > now.getTime()) {
    return NextResponse.json({ error: "tugas belum dipublikasikan" }, { status: 404 });
  }
  if (!canSubmit(t, now)) {
    return NextResponse.json({ error: "batas waktu sudah lewat dan tidak boleh terlambat" }, { status: 403 });
  }

  let text: string | null = null;
  let link: string | null = null;
  let file: { fileName: string; mime: string; size: number } | null = null;
  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
    text = String(form.get("text") ?? "").slice(0, 20000) || null;
    link = String(form.get("link") ?? "").slice(0, 2048) || null;
    const f = form.get("file");
    if (f && typeof f !== "string") {
      const buf = Buffer.from(await f.arrayBuffer());
      try {
        file = await saveTaskFile(a.school.id, taskId, f.name || "file", buf);
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 400 });
      }
    }
  } else {
    const body = submitSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
    text = body.data.text ?? null;
    link = body.data.link ?? null;
  }
  if (!text && !link && !file) {
    return NextResponse.json({ error: "isi (teks/link/file) wajib ada" }, { status: 400 });
  }

  const late = isLateSubmit(t, now);
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.upsert({
      where: { taskId_studentId: { taskId, studentId: a.userId } },
      update: {
        text, link,
        ...(file ? { fileName: file.fileName, mime: file.mime, size: file.size } : {}),
        submittedAt: now, isLate: late, score: null, feedback: null, gradedById: null, gradedAt: null,
      },
      create: {
        schoolId: a.school.id, taskId, studentId: a.userId,
        text, link,
        fileName: file?.fileName ?? null, mime: file?.mime ?? null, size: file?.size ?? null,
        submittedAt: now, isLate: late,
      },
    }));
  await logAuth(a.school.id, "TASK.SUBMIT", { actorId: a.userId, meta: { taskId, late } });
  return NextResponse.json({ submission: { id: row.id, isLate: late, submittedAt: now } }, { status: 201 });
}
