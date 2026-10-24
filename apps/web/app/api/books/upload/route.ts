import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize, err } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

// POST /api/books/upload — ADMIN sekolah (atau SUPER_ADMIN): unggah file ebook.
// Format: pdf, epub, docx, md, txt. Maks 25 MB. Disimpan di
// <UPLOADS_ROOT>/<schoolId>/books/<nama acak> dan dicatat di tabel Book.
const MAX_BYTES = 25 * 1024 * 1024;
const KINDS: Record<string, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  txt: "text/plain",
};
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/markdown": "md",
  "text/plain": "txt",
};

type BookAuth =
  | { ok: true; role: "ADMIN"; schoolId: string; userId: string }
  | { ok: true; role: "SUPER_ADMIN"; schoolId: null; userId: string };

async function gate(req: NextRequest): Promise<BookAuth | { ok: false; status: number; error: string }> {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!a.ok) return a;
  if (a.role === "SUPER_ADMIN") return { ok: true, role: "SUPER_ADMIN", schoolId: null, userId: a.userId };
  if (a.role === "ADMIN" && a.school) return { ok: true, role: "ADMIN", schoolId: a.school.id, userId: a.userId };
  return err(403, "forbidden");
}

// Deteksi tipe dari magic bytes (bukan dari header klien).
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString("hex") === "25504446") return "pdf"; // %PDF
  if (buf.subarray(0, 2).toString("hex") === "504b") return "epub"; // ZIP (epub = zip)
  if (buf.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") return "docx"; // OLE2 (doc/docx)
  const head = buf.subarray(0, 64).toString("utf8").trimStart();
  if (head.startsWith("#") || head.startsWith("---")) return "md";
  if (!/[^\x09\x0a\x0d\x20-\x7e]/.test(head)) return "txt";
  return null;
}

export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim().slice(0, 200);
  if (!(file instanceof File)) return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "file kosong" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file melebihi 25MB" }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return NextResponse.json({ error: "format ebook tidak didukung (pdf, epub, docx, md, txt)" }, { status: 400 });

  // Sekolah mana? ADMIN -> sekolahnya; SUPER_ADMIN -> ?schoolId= (wajib).
  let schoolId: string;
  if (a.role === "SUPER_ADMIN") {
    const q = (new URL(req.url).searchParams.get("schoolId") ?? "").trim();
    const sch = q ? await getRootDb().school.findUnique({ where: { id: q }, select: { id: true } }) : null;
    if (!sch) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });
    schoolId = sch.id;
  } else {
    schoolId = a.schoolId;
  }

  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  const dir = path.join(process.env.UPLOADS_ROOT ?? "/data/uploads", schoolId, "books");
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, name), buf);

  const mime = Object.entries(EXT_BY_MIME).find(([, ext]) => ext === kind)?.[0] ?? "application/octet-stream";
  const data = {
    schoolId,
    title: title || file.name.slice(0, 200),
    source: "UPLOAD" as const,
    fileKey: name,
    mimeType: mime,
    sizeBytes: buf.length,
    createdById: a.userId,
  };
  const row = await runAsSchool(db, schoolId, (tx) => tx.book.create({ data }));
  return NextResponse.json({ book: row }, { status: 201 });
}
