import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { authorize, err } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

// Skema input buku. Satu endpoint untuk 3 sumber:
//   LINK    -> title + url (+ author, coverUrl)
//   MARKDOWN-> title + bodyMd (teks yang dipaste)
//   UPLOAD  -> ditangani route /api/books/upload (multipart)
const bookSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().max(160).optional().nullable(),
  coverUrl: z.string().trim().max(500).optional().nullable(),
  url: z.string().trim().max(1000).optional().nullable(),
  bodyMd: z.string().max(500_000).optional().nullable(),
  published: z.boolean().optional(),
});

export const BOOK_KINDS = ["LINK", "UPLOAD", "MARKDOWN"] as const;

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

// GET /api/books?scope=school|platform&q=&page=&perPage=
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 128);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") ?? 20) || 20));
  const scope = url.searchParams.get("scope") === "platform" ? "platform" : "school";

  // SUPER_ADMIN boleh baca semua sekolah; admin sekolah hanya sekolahnya.
  const schoolId = a.role === "SUPER_ADMIN" ? url.searchParams.get("schoolId") : a.schoolId;
  const root = getRootDb();
  const where = {
    ...(scope === "platform" ? { schoolId: null } : schoolId ? { schoolId } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [rows, total] = await Promise.all([
    root.book.findMany({
      where,
      orderBy: [{ published: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, schoolId: true, title: true, author: true, coverUrl: true, source: true,
        url: true, mimeType: true, sizeBytes: true, published: true, createdAt: true,
      },
    }),
    root.book.count({ where }),
  ]);
  return NextResponse.json({ rows, total, page, perPage });
}

// POST /api/books — tambah buku (LINK atau MARKDOWN; UPLOAD lewat route upload).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = bookSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const d = parsed.data;

  // Tentukan sumber: bodyMd -> MARKDOWN, url -> LINK.
  const source = d.bodyMd?.trim() ? "MARKDOWN" : d.url?.trim() ? "LINK" : null;
  if (!source) return NextResponse.json({ error: "isi url atau bodyMd" }, { status: 400 });
  if (source === "LINK" && !/^https?:\/\/\S+$/i.test(d.url ?? ""))
    return NextResponse.json({ error: "url harus diawali http:// atau https://" }, { status: 400 });

  const data = {
    title: d.title,
    author: d.author ?? null,
    coverUrl: d.coverUrl ?? null,
    source,
    url: d.url ?? null,
    bodyMd: d.bodyMd ?? null,
    published: d.published ?? false,
    createdById: a.userId,
  } as const;

  let row;
  if (a.role === "SUPER_ADMIN") {
    // Root: tanpa schoolId -> buku platform; dengan schoolId -> buku sekolah itu.
    const target = typeof raw?.schoolId === "string" && raw.schoolId ? raw.schoolId : null;
    if (target) {
      const exists = await getRootDb().school.findUnique({ where: { id: target }, select: { id: true } });
      if (!exists) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });
    }
    row = await getRootDb().book.create({ data: { ...data, schoolId: target } });
  } else {
    row = await runAsSchool(db, a.schoolId, (tx) => tx.book.create({ data: { ...data, schoolId: a.schoolId } }));
  }
  return NextResponse.json({ book: row }, { status: 201 });
}
