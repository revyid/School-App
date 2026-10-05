import { NextRequest, NextResponse } from "next/server";
import { db } from "@sms/db/client";
import { schoolSlugFromHost } from "@sms/shared/school";

// GET /api/portal/popular-books — daftar buku gratis sejarah & kebudayaan Indonesia
// Sumber resmi: Arsip Kemendikbud & Open Access Sejarah Indonesia (Internet Archive Public API)
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
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (cache && Date.now() - cache.at < TTL && cache.rows.length > 0) {
    return NextResponse.json({ rows: cache.rows, cached: true });
  }

  try {
    const qUrl =
      "https://archive.org/advancedsearch.php?q=title:(sejarah+indonesia)+AND+mediatype:texts&fl[]=identifier,title,creator,description,year&rows=20&output=json";
    const res = await fetch(qUrl, { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error("Gagal mengambil data katalog");

    const data = await res.json();
    const docs = data?.response?.docs ?? [];

    const subjects = ["Sejarah", "Nusantara", "Budaya", "Perjuangan", "Nasional"];

    const rows: Row[] = docs.map((d: any, i: number) => {
      const ident = d.identifier;
      const rawTitle = d.title || "Buku Sejarah Indonesia";
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
