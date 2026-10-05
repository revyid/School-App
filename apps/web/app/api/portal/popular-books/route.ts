import { NextRequest, NextResponse } from "next/server";
import { db } from "@sms/db/client";
import { schoolSlugFromHost } from "@sms/shared/school";
import { OpenLibraryProvider } from "@sms/shared/portal";

// GET /api/portal/popular-books — publik (tanpa login): daftar buku populer
// untuk kartu "rak bacaan" di landing. Query tetap (buku anak populer),
// hanya agregat katalog terbuka (tanpa data sekolah = tanpa runAsSchool).
// Cache 6 jam di memori proses (hemat Wi-Fi sekolah + cepat).
const QUERIES = [
  { q: "best children picture books", subject: "Cerita" },
  { q: "children science picture book", subject: "Sains" },
  { q: "children activity book", subject: "Aktivitas" },
  { q: "children atlas animals", subject: "Dunia" },
] as const;
const COLORS = ["#e85e43", "#97c4db", "#f5c94a", "#aec6a4"];

type Row = { title: string; authors: string[]; year?: number; infoUrl?: string; coverUrl?: string; subject: string; color: string };
let cache: { at: number; rows: Row[] } | null = null;
const TTL = 6 * 60 * 60_000;

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (cache && Date.now() - cache.at < TTL) return NextResponse.json({ rows: cache.rows, cached: true });
  const provider = new OpenLibraryProvider();
  const settled = await Promise.allSettled(
    QUERIES.map(async (item, i) => {
      const r = await provider.search(item.q, 1);
      const b = r[0];
      if (!b) return null;
      return {
        title: b.title,
        authors: b.authors,
        year: b.year,
        infoUrl: b.infoUrl,
        coverUrl: b.coverUrl,
        subject: item.subject,
        color: COLORS[i % COLORS.length],
      } as Row;
    }),
  );
  const rows = settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
  if (rows.length > 0) cache = { at: Date.now(), rows };
  if (rows.length === 0 && cache) return NextResponse.json({ rows: cache.rows, cached: true });
  return NextResponse.json({ rows });
}
