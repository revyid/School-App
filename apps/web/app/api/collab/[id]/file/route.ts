import { stat, readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { collabFilePath } from "@/server/collab-files";

// GET /api/collab/[id]/file?m=<messageId> — lampiran (peserta thread saja).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.findUnique({ where: { id: id.slice(0, 64) } }));
  if (!t) return NextResponse.json({ error: "thread tidak ditemukan" }, { status: 404 });
  const allowed =
    a.role === "ADMIN" || t.senderId === a.userId || (a.role === "GURU" && t.recipients.includes(a.userId));
  if (!allowed) return NextResponse.json({ error: "bukan peserta thread ini" }, { status: 403 });
  const mid = (new URL(req.url).searchParams.get("m") ?? "").slice(0, 64);
  const m = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabMessage.findFirst({ where: { id: mid, threadId: t.id } }));
  if (!m?.fileName) return NextResponse.json({ error: "lampiran tidak ada" }, { status: 404 });
  let abs: string;
  try {
    abs = collabFilePath(a.school.id, m.fileName);
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
  const ext = (m.fileName.split(".").pop() ?? "bin").toLowerCase();
  const ctype =
    ext === "pdf" ? "application/pdf"
    : ext === "png" ? "image/png"
    : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "gif" ? "image/gif"
    : ext === "webp" ? "image/webp"
    : ext === "zip" ? "application/zip"
    : "application/octet-stream";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": ctype,
      "content-length": String(st.size),
      "content-disposition": `inline; filename="${m.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
