"use client";

import Image from "next/image";
import Logo from "@/components/Logo";
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
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}><Logo /></a>
        <span style={{ color: "#74746d", fontSize: 13 }}>{schoolName}</span>
        <AuthCta className="btn-sticker" style={{ marginLeft: "auto", background: "#171716", color: "#fffdf8", textDecoration: "none" }} loginLabel="Masuk ↗" dashLabel="Buka dasbor ↗" />
      </header>

      <main style={{ padding: "clamp(28px, 5vw, 64px) clamp(20px, 6vw, 88px) 72px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <p className="kicker">Rak bacaan</p>
          <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", margin: "8px 0 12px" }}>
            Cerita kecil, <span style={{ color: "#e85e43" }}>ide besar.</span>
          </h1>
          <p style={{ color: "#74746d", maxWidth: 520 }}>
            {searching ? "Hasil pencarian katalog terbuka." : "Buku populer minggu ini. Klik kartu untuk info dan baca pratinjau."}
          </p>
        </Reveal>

        <form onSubmit={cari} style={{ display: "flex", gap: 10, margin: "22px 0", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul atau pengarang…"
            aria-label="Cari buku"
            style={{ flex: 1, minWidth: 200, borderRadius: 999, border: "1px solid rgba(23,23,22,.3)", background: "#fffdf8", padding: "10px 18px", fontSize: 14, color: "#171716" }}
          />
          <button type="submit" disabled={busy} className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
            {busy ? "Mencari…" : "Cari"}
          </button>
          {searching && (
            <button type="button" onClick={() => { setRows([]); setMsg(null); setQ(""); }} className="btn-sticker btn-ghost">
              Kembali ke populer
            </button>
          )}
        </form>
        {msg && <p style={{ color: "#74746d", fontSize: 13 }}>{msg}</p>}

        {!popular.data && !searching ? (
          <p style={{ color: "#74746d" }}>Memuat buku populer…</p>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 28 }}>
            <p style={{ color: "#74746d", margin: 0 }}>Rak sedang kosong. Coba lagi nanti.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {items.slice(0, 8).map((b, i) => (
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
  const inner = (
    <article className="card-lift" style={{ background: color, borderRadius: 24, overflow: "hidden", minHeight: 300, display: "flex", flexDirection: "column" }}>
      {b.coverUrl ? (
        <div style={{ position: "relative", height: 170 }}>
          <Image src={b.coverUrl} alt={`Sampul ${b.title}`} fill style={{ objectFit: "cover" }} sizes="(max-width: 640px) 100vw, 300px" />
        </div>
      ) : (
        <div style={{ height: 170, display: "grid", placeItems: "center", fontSize: 54, borderBottom: "1px solid rgba(23,23,22,.15)" }} aria-hidden="true">
          ✎
        </div>
      )}
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {b.subject && <span style={{ fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase", opacity: 0.7 }}>{b.subject}</span>}
        <strong style={{ fontSize: 15, letterSpacing: "-0.02em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</strong>
        <span style={{ fontSize: 12.5, opacity: 0.8 }}>{(b.authors ?? []).slice(0, 2).join(", ") || "Pengarang tak tercatat"}{b.year ? ` (${b.year})` : ""}</span>
        <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700 }}>Info & baca ↗</span>
      </div>
    </article>
  );
  return b.infoUrl ? (
    <a href={b.infoUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>{inner}</a>
  ) : inner;
}
