"use client";

import PublicHeader from "@/components/PublicHeader";
import Reveal from "@/components/Reveal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api, useFetch } from "@/app/lib/api";
import { useState } from "react";
import { useTrackView } from "@/app/lib/use-track-view";

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

type SchoolBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  source: "LINK" | "UPLOAD" | "MARKDOWN";
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  published: boolean;
};

const SOURCE_LABEL: Record<SchoolBook["source"], string> = {
  LINK: "Tautan",
  UPLOAD: "File",
  MARKDOWN: "Markdown",
};

export default function BukuClient({ schoolName }: { schoolName: string }) {
  // View halaman katalog (1 per identitas per 15 menit, di-throttle server).
  useTrackView("PORTAL", "buku");
  const popular = useFetch<{ rows: Book[] }>("/api/portal/popular-books");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Book[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Buku milik sekolah (library internal). Perlu login; guest melihat ajakan masuk.
  const schoolBooks = useFetch<{ rows: SchoolBook[] }>("/api/books?scope=school&perPage=24");
  const me = useFetch<{ user: { role: string } }>("/api/auth/me");
  const role = me.data?.user.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [toDelete, setToDelete] = useState<SchoolBook | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  async function hapus(id: string) {
    const res = await api(`/api/books/${id}`, { method: "DELETE" });
    setToDelete(null);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setDeleteMsg(d.error || `Gagal menghapus (${res.status})`);
      return;
    }
    setDeleteMsg(null);
    void schoolBooks.reload();
  }

  async function cari(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) {
      setMsg("Ketik minimal 2 huruf.");
      return;
    }
    setBusy(true);
    setHasSearched(true);
    setRows([]);
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

  const searching = hasSearched;
  const items = searching ? rows : (popular.data?.rows ?? []);
  const schoolRows = (schoolBooks.data?.rows ?? []).filter((b) => isAdmin || b.published);

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      <PublicHeader schoolName={schoolName} />

      <main style={{ padding: "clamp(28px, 5vw, 64px) clamp(20px, 6vw, 88px) 72px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <p className="kicker">Koleksi Terbuka</p>
          <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", margin: "8px 0 12px" }}>
            E-Book & <span style={{ color: "#e85e43" }}>Materi Pelajaran.</span>
          </h1>
          <p style={{ color: "#74746d", maxWidth: 580 }}>
            {searching ? "Hasil penelusuran arsip & materi pelajaran." : "Buku teks resmi Kemendikbud & literatur pelajaran gratis. Dilengkapi sampul & baca langsung."}
          </p>
        </Reveal>

        <form onSubmit={cari} style={{ display: "flex", gap: 10, margin: "22px 0", flexWrap: "wrap" }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari buku, materi, tokoh, dsb…"
            aria-label="Cari buku"
            style={{ flex: 1, minWidth: 200, borderRadius: 999, border: "1px solid rgba(23,23,22,.3)", background: "#fffdf8", padding: "10px 18px", fontSize: 14, color: "#171716" }}
          />
          <button type="submit" disabled={busy} className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
            {busy ? "Mencari…" : "Cari"}
          </button>
          {searching && (
            <button type="button" onClick={() => { setRows([]); setHasSearched(false); setMsg(null); setQ(""); }} className="btn-sticker btn-ghost">
              Kembali ke koleksi
            </button>
          )}
        </form>
        {msg && <p role="status" aria-live="polite" style={{ color: "#74746d", fontSize: 13 }}>{msg}</p>}

        {popular.loading && !searching ? (
          <p role="status" style={{ color: "#74746d" }}>Memuat katalog buku…</p>
        ) : popular.error && !searching ? (
          <div className="card" style={{ padding: 28 }}><p role="alert" style={{ color: "#c94b35", margin: "0 0 12px" }}>Katalog gagal dimuat. Periksa koneksi lalu coba lagi.</p><button type="button" className="btn-sticker btn-ghost" onClick={popular.reload}>Coba lagi</button></div>
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: 28 }}>
            <p style={{ color: "#74746d", margin: 0 }}>Rak sedang kosong. Coba lagi nanti.</p>
          </div>
        ) : (
          <div className="ebook-shelf">
            {items.map((b, i) => (
              <Reveal key={`${b.title}-${i}`} delay={(i % 4) * 80}>
                <BookCard b={b} color={b.color ?? CARD_COLORS[i % CARD_COLORS.length]} />
              </Reveal>
            ))}
          </div>
        )}

        <section style={{ marginTop: 56, paddingTop: 32, borderTop: "1px solid rgba(23,23,22,.15)" }} aria-labelledby="buku-sekolah">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
            <div>
              <p className="kicker">Perpustakaan Sekolah</p>
              <h2 id="buku-sekolah" className="display" style={{ fontSize: "clamp(26px, 3vw, 38px)", margin: "6px 0 4px" }}>Buku sekolah</h2>
              <p style={{ color: "#74746d", fontSize: 13.5, margin: 0 }}>Koleksi yang diunggah dan dikurasi oleh sekolah.</p>
            </div>
            {isAdmin && (
              <a href="/admin/buku" className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
                + Tambah buku
              </a>
            )}
          </div>

          {schoolBooks.loading ? (
            <p role="status" style={{ color: "#74746d" }}>Memuat buku sekolah…</p>
          ) : schoolBooks.error ? (
            <div className="card" style={{ padding: 22 }}>
              <p style={{ margin: "0 0 10px", color: "#74746d" }}>
                Masuk dulu untuk melihat koleksi buku sekolah.
              </p>
              <a href={`/login?next=${encodeURIComponent("/buku")}`} className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>
                Masuk
              </a>
            </div>
          ) : schoolRows.length === 0 ? (
            <div className="card" style={{ padding: 22 }}>
              <p style={{ margin: 0, color: "#74746d" }}>Belum ada buku sekolah yang terbit.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {schoolRows.map((b) => (
                <article key={b.id} className="card" style={{ padding: 16, gap: 8, background: "#fffdf8" }}>
                  {b.coverUrl && (
                    <div style={{ height: 120, borderRadius: 8, overflow: "hidden", background: "rgba(23,23,22,.06)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, border: "1px solid #171716", borderRadius: 99, padding: "1px 8px" }}>
                      {SOURCE_LABEL[b.source]}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: "1px 8px", background: b.published ? "#dcebd2" : "#efe7d2", color: b.published ? "#3f5c2c" : "#7a6a3d" }}>
                      {b.published ? "Terbit" : "Draf"}
                    </span>
                  </div>
                  <a href={`/buku/${b.id}`} style={{ color: "#171716", fontWeight: 700, fontSize: 15, lineHeight: 1.3, textDecoration: "none" }}>
                    {b.title}
                  </a>
                  <small style={{ color: "#74746d", fontSize: 12 }}>{b.author || "Tanpa penulis"}</small>
                  <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                    <a href={`/buku/${b.id}`} className="btn-sticker btn-ghost" style={{ textDecoration: "none", fontSize: 12, padding: "5px 12px" }}>
                      Baca
                    </a>
                    {isAdmin && (
                      <button type="button" onClick={() => setToDelete(b)} style={{ background: "none", border: "none", color: "#c94b35", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        Hapus
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          {deleteMsg && <p role="alert" style={{ color: "#c94b35", fontSize: 13 }}>{deleteMsg}</p>}
        </section>
      </main>

      <ConfirmDialog
        open={!!toDelete}
        title="Hapus buku?"
        message={toDelete ? `"${toDelete.title}" akan dihapus permanen.` : ""}
        confirmLabel="Ya, hapus"
        onConfirm={() => {
          if (toDelete) return hapus(toDelete.id);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function BookCard({ b, color }: { b: Book; color: string }) {
  const author = (b.authors ?? []).slice(0, 2).join(", ");
  const inner = (
    <article className="ebook-card" style={{ background: color }}>
      {b.coverUrl && (
        <div style={{ width: "100%", height: 140, marginBottom: 12, borderRadius: 8, overflow: "hidden", background: "rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.coverUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        </div>
      )}
      <span className="book-tag" style={{ alignSelf: "flex-start", background: "#fffdf8", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: "1px solid #171716", marginBottom: 6 }}>
        {b.subject ?? "Umum"}
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
