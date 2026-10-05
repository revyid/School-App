import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { OpenLibraryProvider } from "@sms/shared/portal";
import { hit } from "@/server/rate-limit";

// GET /api/portal/search-books?q= — publik (tanpa login): pencarian katalog
// e-book via Open Library. Rate limit per-IP 30/mnt + cache 10 menit
// (mencegah abuse endpoint publik; hemat Wi-Fi sekolah).
const cache = new Map<string, { at: number; rows: unknown }>();

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ip = req.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";
  const rl = await hit(`rl:portal-books:${ip}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu banyak pencarian, coba lagi nanti" }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 128);
  if (q.length < 2) return NextResponse.json({ rows: [] });
  const c = cache.get(q);
  if (c && Date.now() - c.at < 10 * 60_000) return NextResponse.json({ rows: c.rows, cached: true });
  try {
    const rows = await new OpenLibraryProvider().search(q, 12);
    cache.set(q, { at: Date.now(), rows });
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "katalog tak dapat dijangkau (offline?)" }, { status: 502 });
  }
}
