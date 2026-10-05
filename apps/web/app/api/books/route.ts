import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { OpenLibraryProvider } from "@sms/shared/portal";

// GET /api/books?q= — katalog e-book via Open Library (tanpa scraping).
// Cache 10 menit di memori proses (hemat Wi-Fi sekolah).
const cache = new Map<string, { at: number; rows: unknown }>();

export async function GET(req: NextRequest) {
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
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 128);
  if (q.length < 2) return NextResponse.json({ rows: [] });
  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < 10 * 60_000) return NextResponse.json({ rows: hit.rows, cached: true });
  try {
    const rows = await new OpenLibraryProvider().search(q, 10);
    cache.set(q, { at: Date.now(), rows });
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "katalog tak dapat dijangkau (offline?)" }, { status: 502 });
  }
}
