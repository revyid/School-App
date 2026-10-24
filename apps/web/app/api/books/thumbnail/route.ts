import { promises as fsp } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize, err } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

// POST /api/books/thumbnail — unggah sampul buku (PNG/JPG/WEBP ≤ 2MB).
// Disimpan di <UPLOADS_ROOT>/<schoolId>/books/covers/<nama acak>.
const MAX_BYTES = 2 * 1024 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG = Buffer.from([0xff, 0xd8, 0xff]);

function extOf(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 4).equals(PNG)) return "png";
  if (buf.subarray(0, 3).equals(JPG)) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "webp";
  return null;
}

export async function POST(req: NextRequest) {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  if (a.role !== "ADMIN" && a.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES)
    return NextResponse.json({ error: "sampul harus 1 byte - 2MB" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extOf(buf);
  if (!ext) return NextResponse.json({ error: "format harus PNG/JPG/WEBP" }, { status: 400 });

  const name = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
  // Validasi ke DB dulu: schoolId dari query tidak boleh jadi bagian path file.
  const q = a.role === "SUPER_ADMIN" ? (new URL(req.url).searchParams.get("schoolId") ?? "").trim() : "";
  const sch = q ? await getRootDb().school.findUnique({ where: { id: q }, select: { id: true } }) : null;
  const schoolId = a.role === "SUPER_ADMIN" ? (sch?.id ?? "") : a.school!.id;
  if (!schoolId) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });

  const dir = path.join(process.env.UPLOADS_ROOT ?? "/data/uploads", schoolId, "books", "covers");
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, name), buf);

  return NextResponse.json({ ok: true, coverUrl: `/api/books/cover?f=${name}` }, { status: 201 });
}
