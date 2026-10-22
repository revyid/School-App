import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize, err } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

// GET /api/books/[id]/file — stream file ebook (pdf/epub/docx/md/txt).
// Tenant hanya boleh file sekolahnya; root boleh semua. Nama file sudah acak
// (hex32) dari server, tapi tetap divalidasi sebelum dibaca.
const SAFE = /^[a-f0-9]{32}\.(pdf|epub|docx|md|txt)$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const { id } = await params;
  const book =
    a.role === "SUPER_ADMIN"
      ? await getRootDb().book.findUnique({ where: { id } })
      : await runAsSchool(db, a.school!.id, (tx) => tx.book.findUnique({ where: { id } }));
  if (!book) return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  if (a.role !== "SUPER_ADMIN" && book.schoolId !== a.school!.id)
    return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  if (!book.fileKey || !SAFE.test(book.fileKey))
    return NextResponse.json({ error: "buku tidak punya file" }, { status: 404 });

  const filePath = path.join(process.env.UPLOADS_ROOT ?? "/data/uploads", book.schoolId ?? "", "books", book.fileKey);
  try {
    await fsp.access(filePath);
  } catch {
    return NextResponse.json({ error: "file hilang" }, { status: 404 });
  }
  const stream = createReadStream(filePath);
  const inline = book.mimeType === "application/pdf" || book.mimeType === "text/markdown" || book.mimeType === "text/plain";
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "content-type": book.mimeType ?? "application/octet-stream",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${book.fileKey}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=300",
    },
  });
}
