import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { submitSchema, canSubmit, isLateSubmit } from "@sms/shared/lms";
import { siswaClassId } from "@/server/lms-scope";
import { saveFileBuffer, removeFile } from "@/server/files";
import { validateCategoryFiles, awardSubmitExp } from "@/server/task-helpers";

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

type Saved = { fileName: string; mime: string; size: number; originalName: string };

// Deteksi mime dari magic bytes untuk memilih purpose batas (D6).
function detectMime(buf: Buffer): string {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return "application/octet-stream";
}
function purposeOf(buf: Buffer): "image" | "pdf" | "doc" | "video-answer" {
  const m = detectMime(buf);
  if (m.startsWith("video/")) return "video-answer";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  return "doc";
}

// POST /api/tasks/[id]/submit — SISWA kirim.
// multipart: text?, link?, file (tugas tanpa kategori), file_<categoryId> (per kategori, ≤1).
// Tugas kelompok (D1): pengumpulan per kelompok; anggota mana pun boleh mengumpulkan.
// Atomic: file baru disimpan dulu; bila transaksi DB gagal, file baru dibersihkan;
// file LAMA yang diganti dihapus hanya setelah transaksi sukses.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const taskId = id.slice(0, 64);
  const rl = await hit(`rl:submit:${a.school.id}:${a.userId}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: taskId },
      include: { categories: { orderBy: { position: "asc" } } },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  const cid = await siswaClassId(a.school.id, a.userId);
  if (t.classId !== cid) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  const now = new Date();
  if (t.status !== "PUBLISHED" || t.publishAt.getTime() > now.getTime()) {
    return NextResponse.json({ error: "tugas belum dipublikasikan" }, { status: 404 });
  }
  if (!canSubmit(t, now)) {
    return NextResponse.json({ error: "batas waktu sudah lewat dan tidak boleh terlambat" }, { status: 403 });
  }

  // Tugas kelompok: wajib punya kelompok (D1).
  let groupId: string | null = null;
  let memberIds: string[] = [a.userId];
  if (t.isGroup) {
    const gm = await runAsSchool(db, a.school.id, (tx) =>
      tx.taskGroupMember.findFirst({
        where: { taskId, studentId: a.userId },
        include: { group: { include: { members: { select: { studentId: true } } } } },
      }));
    if (!gm) {
      return NextResponse.json({ error: "Tugas kelompok — bentuk kelompok dulu sebelum mengumpulkan" }, { status: 409 });
    }
    groupId = gm.groupId;
    memberIds = gm.group.members.map((m) => m.studentId);
  }

  let text: string | null = null;
  let link: string | null = null;
  let plainFile: Saved | null = null;
  const catFiles = new Map<string, Saved>();

  const ctype = req.headers.get("content-type") ?? "";
  const savedFiles: { name: string }[] = [];
  const dir = [a.school.id, "tasks", taskId];
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
      text = String(form.get("text") ?? "").slice(0, 20000) || null;
      link = String(form.get("link") ?? "").slice(0, 2048) || null;

      // File tunggal (tugas tanpa kategori).
      const f = form.get("file");
      if (f && typeof f !== "string") {
        const buf = Buffer.from(await f.arrayBuffer());
        plainFile = await saveFileBuffer(dir, buf, purposeOf(buf), f.name || "file");
        savedFiles.push({ name: plainFile.fileName });
      }
      // File per kategori: field "file_<categoryId>".
      for (const c of t.categories) {
        const cf = form.get(`file_${c.id}`);
        if (cf && typeof cf !== "string") {
          const buf = Buffer.from(await cf.arrayBuffer());
          const saved = await saveFileBuffer(dir, buf, purposeOf(buf), cf.name || "file");
          catFiles.set(c.id, saved);
          savedFiles.push({ name: saved.fileName });
        }
      }
      // Validasi kategori wajib + tipe (T2).
      const err = validateCategoryFiles(
        t.categories.map((c) => ({ id: c.id, name: c.name, required: c.required, accept: c.accept as string[] })),
        new Map([...catFiles].map(([k, v]) => [k, { mime: v.mime, size: v.size }])),
      );
      if (err) {
        for (const s of savedFiles) await removeFile(dir, s.name);
        return NextResponse.json({ error: err }, { status: 400 });
      }
      if (!text && !link && !plainFile && catFiles.size === 0) {
        for (const s of savedFiles) await removeFile(dir, s.name);
        return NextResponse.json({ error: "isi (teks/link/file) wajib ada" }, { status: 400 });
      }
    } else {
      const body = submitSchema.safeParse(await req.json().catch(() => null));
      if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
      text = body.data.text ?? null;
      link = body.data.link ?? null;
      if (t.categories.some((c) => c.required)) {
        return NextResponse.json({ error: "tugas ini butuh file per kategori — kirim via formulir unggah" }, { status: 400 });
      }
      if (!text && !link) return NextResponse.json({ error: "isi (teks/link) wajib ada" }, { status: 400 });
    }
  } catch (e) {
    for (const s of savedFiles) await removeFile(dir, s.name);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const late = isLateSubmit(t, now);
  try {
    const { replaced } = await runAsSchool(db, a.school.id, async (tx) => {
      // Cari submission: per kelompok (bila isGroup) atau per siswa.
      const existing = t.isGroup && groupId
        ? await tx.submission.findFirst({ where: { taskId, groupId }, include: { files: true } })
        : await tx.submission.findUnique({ where: { taskId_studentId: { taskId, studentId: a.userId } }, include: { files: true } });

      const base = {
        text, link,
        submittedAt: now, isLate: late,
        score: null, feedback: null, gradedById: null, gradedAt: null,
        submittedById: a.userId,
      };
      const replaced: string[] = [];

      // Upsert file (per kategori + tunggal) via find-then-write (partial unique index
      // menjamin keunikan; konflik = kondisi balapan yang jarang → 500 dengan cleanup).
      const upsertFile = async (submissionId: string, categoryId: string | null, saved: Saved) => {
        const old = await tx.submissionFile.findFirst({ where: { submissionId, categoryId } });
        if (old && old.fileName !== saved.fileName) replaced.push(old.fileName);
        if (old) {
          await tx.submissionFile.update({
            where: { id: old.id },
            data: { fileName: saved.fileName, originalName: saved.originalName, mime: saved.mime, size: saved.size },
          });
        } else {
          await tx.submissionFile.create({
            data: { schoolId: a.school.id, submissionId, categoryId, fileName: saved.fileName, originalName: saved.originalName, mime: saved.mime, size: saved.size },
          });
        }
      };

      if (existing) {
        await tx.submission.update({ where: { id: existing.id }, data: base });
        if (existing.fileName && plainFile && existing.fileName !== plainFile.fileName) replaced.push(existing.fileName);
        if (plainFile) {
          await upsertFile(existing.id, null, plainFile);
          await tx.submission.update({ where: { id: existing.id }, data: { fileName: plainFile.fileName, mime: plainFile.mime, size: plainFile.size } });
        } else if (existing.fileName && !t.categories.length) {
          // Kirim ulang tanpa file: hapus jejak kolom lama (file tetap sampai bersihkan manual).
        }
        for (const [catId, saved] of catFiles) await upsertFile(existing.id, catId, saved);
        return { sub: existing, replaced };
      }

      const created = await tx.submission.create({
        data: {
          schoolId: a.school.id, taskId, studentId: t.isGroup ? memberIds[0] : a.userId,
          ...(t.isGroup ? { groupId } : {}),
          text, link,
          fileName: plainFile?.fileName ?? null, mime: plainFile?.mime ?? null, size: plainFile?.size ?? null,
          submittedAt: now, isLate: late, submittedById: a.userId,
        },
      });
      if (plainFile) await upsertFile(created.id, null, plainFile);
      for (const [catId, saved] of catFiles) await upsertFile(created.id, catId, saved);
      return { sub: created, replaced };
    });

    // B7: hapus file lama yang diganti SETELAH transaksi sukses.
    for (const name of replaced) await removeFile(dir, name);

    // T8: EXP untuk semua anggota kelompok / pengumpul — dedupe per siswa.
    await awardSubmitExp(a.school.id, taskId, memberIds, late);

    await logAuth(a.school.id, "TASK.SUBMIT", { actorId: a.userId, meta: { taskId, late, groupId } });
    return NextResponse.json({ submission: { ok: true, isLate: late, submittedAt: now } }, { status: 201 });
  } catch (e) {
    // DB gagal → bersihkan file yang baru disimpan (atomic).
    for (const s of savedFiles) await removeFile(dir, s.name);
    const msg = String((e as Error).message ?? "");
    if (msg.includes("Submission_taskId_groupId_key")) {
      return NextResponse.json({ error: "kelompokmu sudah mengumpulkan tugas ini" }, { status: 409 });
    }
    console.error("[submit] gagal:", msg);
    return NextResponse.json({ error: "gagal menyimpan pengumpulan" }, { status: 500 });
  }
}
