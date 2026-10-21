import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicSchool } from "@/lib/public-cache";

// GET /api/portal/popular-books — daftar buku pelajaran gratis semua mapel
// Sumber: katalog buku terbuka (Internet Archive Public API)
const COLORS = ["#e85e43", "#97c4db", "#f5c94a", "#aec6a4"];

type Row = {
  title: string;
  authors: string[];
  year?: number;
  infoUrl?: string;
  coverUrl?: string;
  subject: string;
  color: string;
};

let cache: { at: number; rows: Row[] } | null = null;
const TTL = 6 * 60 * 60_000; // 6 jam cache

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Cek sekolah lewat cache identitas publik (60 dtk, tag school:<slug>)
  // supaya katalog populer tidak query Postgres tiap request.
  const school = await getPublicSchool(slug);
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (cache && Date.now() - cache.at < TTL && cache.rows.length > 0) {
    return NextResponse.json({ rows: cache.rows, cached: true });
  }

  try {
    const qUrl =
      "https://archive.org/advancedsearch.php?q=mediatype:texts+AND+language:(ind+OR+eng)&fl[]=identifier,title,creator,description,year&rows=20&output=json";
    const res = await fetch(qUrl, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error("Gagal mengambil data katalog");

    const data = await res.json();
    const docs = data?.response?.docs ?? [];

    const subjects = ["Matematika", "IPA", "Bahasa", "IPS", "Umum"];

    const rows: Row[] = docs.map((d: any, i: number) => {
      const ident = d.identifier;
      const rawTitle = d.title || "Buku Pelajaran";
      const cleanTitle = rawTitle.replace(/^KEMENDIKBUD-RI\s*-\s*/i, "").trim();

      const creator = d.creator;
      const authors = Array.isArray(creator) ? creator : creator ? [String(creator)] : ["Pusat Kurikulum & Perbukuan"];

      return {
        title: cleanTitle,
        authors,
        year: d.year ? Number(d.year) : undefined,
        infoUrl: `https://archive.org/details/${ident}`,
        coverUrl: `https://archive.org/services/img/${ident}`,
        subject: subjects[i % subjects.length],
        color: COLORS[i % COLORS.length],
      };
    });

    if (rows.length > 0) {
      cache = { at: Date.now(), rows };
    }

    return NextResponse.json({ rows: rows.slice(0, 12) });
  } catch (err) {
    if (cache) return NextResponse.json({ rows: cache.rows, cached: true });
    return NextResponse.json({ rows: [] });
  }
}
