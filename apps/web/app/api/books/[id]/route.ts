import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize, err } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  author: z.string().trim().max(160).optional().nullable(),
  coverUrl: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().max(1000).optional().nullable(),
  bodyMd: z.string().max(500_000).optional().nullable(),
  published: z.boolean().optional(),
});

// requireRole tidak menerima role campuran -> authorize + cek manual.
// Bentuk hasil dinormalisasi supaya pemanggil tak perlu narrowing union.
type BookAuth =
  | { ok: true; role: "ADMIN"; schoolId: string; userId: string }
  | { ok: true; role: "SUPER_ADMIN"; schoolId: null; userId: string };

async function gate(req: NextRequest): Promise<BookAuth | { ok: false; status: number; error: string }> {
  const a = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!a.ok) return a;
  if (a.role === "SUPER_ADMIN") return { ok: true, role: "SUPER_ADMIN", schoolId: null, userId: a.userId };
  if (a.role === "ADMIN" && a.school) return { ok: true, role: "ADMIN", schoolId: a.school.id, userId: a.userId };
  return err(403, "forbidden");
}

// Satu buku. Admin sekolah hanya boleh buku sekolahnya; root bebas.
async function findBook(id: string, role: "ADMIN" | "SUPER_ADMIN", schoolId: string | null) {
  if (role === "SUPER_ADMIN") return getRootDb().book.findUnique({ where: { id } });
  return runAsSchool(db, schoolId!, (tx) => tx.book.findUnique({ where: { id } }));
}

// GET /api/books/[id] — detail satu buku (dipakai halaman pembaca).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const book = await findBook(id, a.role, a.schoolId);
  if (!book) return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  if (a.role !== "SUPER_ADMIN" && book.schoolId !== a.schoolId)
    return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ book });
}

// PATCH /api/books/[id] — ubah metadata / publish / unpublish.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const existing = await findBook(id, a.role, a.schoolId);
  if (!existing) return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  if (a.role !== "SUPER_ADMIN" && existing.schoolId !== a.schoolId)
    return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });

  const row =
    a.role === "SUPER_ADMIN"
      ? await getRootDb().book.update({ where: { id }, data: parsed.data })
      : await runAsSchool(db, a.schoolId, (tx) => tx.book.update({ where: { id }, data: parsed.data }));
  return NextResponse.json({ book: row });
}

// DELETE /api/books/[id] — hapus buku.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const existing = await findBook(id, a.role, a.schoolId);
  if (!existing) return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });
  if (a.role !== "SUPER_ADMIN" && existing.schoolId !== a.schoolId)
    return NextResponse.json({ error: "buku tidak ditemukan" }, { status: 404 });

  if (a.role === "SUPER_ADMIN") await getRootDb().book.delete({ where: { id } });
  else await runAsSchool(db, a.schoolId, (tx) => tx.book.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
