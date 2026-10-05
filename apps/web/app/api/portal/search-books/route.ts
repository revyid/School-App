import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { hit } from "@/server/rate-limit";

// GET /api/portal/search-books?q= — publik (tanpa login): pencarian katalog
// e-book sejarah & nusantara via Internet Archive API
const cache = new Map<string, { at: number; rows: unknown }>();
const COLORS = ["#e85e43", "#97c4db", "#f5c94a", "#aec6a4"];

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
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
    const query = encodeURIComponent(`(title:(${q}) OR description:(${q})) AND (indonesia OR sejarah) AND mediatype:texts`);
    const qUrl = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title,creator,description,year&rows=16&output=json`;
    const res = await fetch(qUrl, { headers: { "User-Agent": "SMS-LMS/1.0" } });
    if (!res.ok) throw new Error("Gagal cari buku");

    const data = await res.json();
    const docs = data?.response?.docs ?? [];

    const rows = docs.map((d: any, i: number) => {
      const ident = d.identifier;
      const rawTitle = d.title || "Buku Bacaan";
      const cleanTitle = rawTitle.replace(/^KEMENDIKBUD-RI\s*-\s*/i, "").trim();

      const creator = d.creator;
      const authors = Array.isArray(creator) ? creator : creator ? [String(creator)] : ["Pusat Kurikulum & Arsip"];

      return {
        title: cleanTitle,
        authors,
        year: d.year ? Number(d.year) : undefined,
        infoUrl: `https://archive.org/details/${ident}`,
        coverUrl: `https://archive.org/services/img/${ident}`,
        subject: "Sejarah RI",
        color: COLORS[i % COLORS.length],
      };
    });

    cache.set(q, { at: Date.now(), rows });
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ error: "katalog tak dapat dijangkau (offline?)" }, { status: 502 });
  }
}
