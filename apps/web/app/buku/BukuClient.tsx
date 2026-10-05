"use client";

import PublicLogo from "@/components/PublicLogo";
import Reveal from "@/components/Reveal";
import AuthCta from "@/app/(portal)/AuthCta";
import { useFetch } from "@/app/lib/api";
import { useState } from "react";

type Book = {
  title: string;
  authors: string[];
  year?: number;
  infoUrl?: string;
  coverUrl?: string;
  subject?: string;
  color?: string;
};

const CARD_COLORS = ["#e85e43", "#97c4db", "#f5c94a", "#aec6a4"];

export default function BukuClient({ schoolName }: { schoolName: string }) {
  const popular = useFetch<{ rows: Book[] }>("/api/portal/popular-books");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Book[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cari(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) {
      setMsg("Ketik minimal 2 huruf.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/portal/search-books?q=${encodeURIComponent(q.trim())}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
      else {
        setRows(d.rows ?? []);
        setMsg((d.rows ?? []).length === 0 ? "Tidak ketemu, coba kata kunci lain." : null);
      }
    } catch {
      setMsg("Katalog tak dapat dijangkau (offline?).");
    } finally {
      setBusy(false);
    }
  }

  const items = rows.length > 0 ? rows : (popular.data?.rows ?? []);
  const searching = rows.length > 0 || msg !== null;

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px clamp(20px, 6vw, 88px)", borderBottom: "1px solid rgba(23,23,22,.14)" }}>
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}><PublicLogo /></a>
        <span style={{ color: "#74746d", fontSize: 13 }}>{schoolName}</span>
        <AuthCta className="btn-sticker" style={{ marginLeft: "auto", background: "#171716", color: "#fffdf8", textDecoration: "none" }} loginLabel="Masuk ↗" dashLabel="Buka dasbor ↗" />
      </header>

      <main style={{ padding: "clamp(28px, 5vw, 64px) clamp(20px, 6vw, 88px) 72px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <p className="kicker">Koleksi Terbuka</p>
          <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", margin: "8px 0 12px" }}>
            E-Book Sejarah & <span style={{ color: "#e85e43" }}>Indonesia.</span>
          </h1>
          <p style={{ color: "#74746d", maxWidth: 580 }}>
            {searching ? "Hasil penelusuran arsip sejarah & materi Indonesia." : "Buku teks resmi Kemendikbud & literatur sejarah Indonesia gratis. Dilengkapi sampul & baca langsung."}
          </p>
        </Reveal>

        <form onSubmit={cari} style={{ display: "flex", gap: 10, margin: "22px 0", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari buku sejarah, kemerdekaan, tokoh, dsb…"
            aria-label="Cari buku"
            style={{ flex: 1, minWidth: 200, borderRadius: 999, border: "1px solid rgba(23,23,22,.3)", background: "#fffdf8", padding: "10px 18px", fontSize: 14, color: "#171716" }}
          />
          <button type="submit" disabled={busy} className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
            {busy ? "Mencari…" : "Cari"}
          </button>
          {searching && (
            <button type="button" onClick={() => { setRows([]); setMsg(null); setQ(""); }} className="btn-sticker btn-ghost">
              Kembali ke koleksi
            </button>
          )}
        </form>
        {msg && <p style={{ color: "#74746d", fontSize: 13 }}>{msg}</p>}

        {!popular.data && !searching ? (
          <p style={{ color: "#74746d" }}>Memuat katalog buku sejarah…</p>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 28 }}>
            <p style={{ color: "#74746d", margin: 0 }}>Rak sedang kosong. Coba lagi nanti.</p>
          </div>
        ) : (
          <div className="ebook-shelf" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {items.map((b, i) => (
              <Reveal key={`${b.title}-${i}`} delay={(i % 4) * 80}>
                <BookCard b={b} color={b.color ?? CARD_COLORS[i % CARD_COLORS.length]} />
              </Reveal>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BookCard({ b, color }: { b: Book; color: string }) {
  const author = (b.authors ?? []).slice(0, 2).join(", ");
  const inner = (
    <article className="ebook-card" style={{ background: color, display: "flex", flexDirection: "column", minHeight: 280, padding: 18, borderRadius: 16, border: "2px solid #171716", position: "relative", overflow: "hidden" }}>
      {b.coverUrl && (
        <div style={{ width: "100%", height: 140, marginBottom: 12, borderRadius: 8, overflow: "hidden", background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.coverUrl}
            alt={b.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}
      <span className="book-tag" style={{ alignSelf: "flex-start", background: "#fffdf8", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: "1px solid #171716", marginBottom: 6 }}>
        {b.subject ?? "Sejarah"}
      </span>
      <strong style={{ fontSize: 15, lineHeight: 1.3, color: "#171716", marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {b.title}
      </strong>
      <small style={{ color: "rgba(23,23,22,0.75)", fontSize: 12, marginTop: "auto" }}>
        {author ? `oleh ${author}${b.year ? ` · ${b.year}` : ""}` : b.year ? `terbit ${b.year}` : "Arsip Terbuka"}
      </small>
      <span className="book-arrow" style={{ position: "absolute", bottom: 14, right: 14, fontWeight: "bold", fontSize: 16 }}>↗</span>
    </article>
  );
  return b.infoUrl ? (
    <a href={b.infoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block" }}>{inner}</a>
  ) : inner;
}
