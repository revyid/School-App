"use client";

// Pembaca buku sekolah. Detail diambil dari /api/books/[id] (butuh login),
// lalu dirender sesuai sumbernya. Markdown memakai RaiMarkdown (tanpa
// dangerouslySetInnerHTML); EPUB belum punya reader, jadi fallback unduh.
import { useEffect, useState } from "react";
import PublicHeader from "@/components/PublicHeader";
import RaiMarkdown from "@/components/RaiMarkdown";
import { useTrackView } from "@/app/lib/use-track-view";

type Book = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  source: "LINK" | "UPLOAD" | "MARKDOWN";
  url: string | null;
  bodyMd: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  published: boolean;
};

type State = {
  loading: boolean;
  error: string | null;
  status: number | null;
  book: Book | null;
};

export default function BukuReader({ id, schoolName }: { id: string; schoolName: string }) {
  useTrackView("BOOK", id);
  const [state, setState] = useState<State>({ loading: true, error: null, status: null, book: null });
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/books/${id}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!alive) return;
      if (!res.ok) {
        setState({ loading: false, error: d.error || `Gagal (${res.status})`, status: res.status, book: null });
        return;
      }
      setState({ loading: false, error: null, status: 200, book: d.book });
    })().catch(() => {
      if (alive) setState({ loading: false, error: "Tidak dapat memuat buku (offline?).", status: null, book: null });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const book = state.book;
  const mime = book?.mimeType ?? "";
  const isTextFile = book?.source === "UPLOAD" && (mime === "text/markdown" || mime === "text/plain");

  // md/txt: ambil isi file sebagai teks biasa.
  useEffect(() => {
    if (!book || !isTextFile) return;
    let alive = true;
    fetch(`/api/books/${book.id}/file`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => alive && setText(t))
      .catch(() => alive && setText(null));
    return () => {
      alive = false;
    };
  }, [book, isTextFile]);

  const fileHref = `/api/books/${id}/file`;

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      <PublicHeader schoolName={schoolName} />

      <main style={{ padding: "clamp(24px, 5vw, 56px) clamp(20px, 6vw, 88px) 72px", maxWidth: 900, margin: "0 auto" }}>
        <a href="/buku" style={{ color: "#74746d", fontSize: 13, textDecoration: "none" }}>← Kembali ke rak</a>

        {state.loading ? (
          <p role="status" style={{ color: "#74746d", marginTop: 24 }}>Memuat buku…</p>
        ) : state.error ? (
          <div className="card" style={{ padding: 28, marginTop: 20 }}>
            <p role="alert" style={{ color: "#c94b35", margin: "0 0 12px" }}>
              {state.status === 401 ? "Buku sekolah hanya bisa dibaca setelah masuk." : state.error}
            </p>
            {state.status === 401 && (
              <a href={`/login?next=${encodeURIComponent(`/buku/${id}`)}`} className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
                Masuk
              </a>
            )}
          </div>
        ) : book ? (
          <article>
            <header style={{ margin: "20px 0 24px" }}>
              <p className="kicker">Buku Sekolah</p>
              <h1 className="display" style={{ fontSize: "clamp(28px, 4vw, 44px)", margin: "6px 0 8px" }}>{book.title}</h1>
              <p style={{ color: "#74746d", margin: 0, fontSize: 13.5 }}>
                {book.author ? `oleh ${book.author}` : "Tanpa penulis"}
                {" · "}
                {book.source === "LINK" ? "Tautan" : book.source === "MARKDOWN" ? "Markdown" : "File"}
                {!book.published && " · Draf"}
              </p>
            </header>

            {book.source === "MARKDOWN" ? (
              <div className="card" style={{ padding: "24px clamp(16px, 4vw, 36px)", background: "#fffdf8", fontSize: 14.5, lineHeight: 1.75 }}>
                <RaiMarkdown text={book.bodyMd ?? ""} />
              </div>
            ) : book.source === "LINK" ? (
              <div className="card" style={{ padding: 24 }}>
                <p style={{ margin: "0 0 14px", color: "#74746d" }}>Buku ini tersedia di sumber eksternal.</p>
                <a href={book.url ?? "#"} target="_blank" rel="noopener noreferrer" className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
                  Buka sumber ↗
                </a>
              </div>
            ) : mime === "application/pdf" ? (
              <div>
                <iframe src={fileHref} title={book.title} style={{ width: "100%", height: 600, border: "1px solid rgba(23,23,22,.2)", borderRadius: 12, background: "#fff" }} />
                <p style={{ marginTop: 14 }}>
                  <a href={fileHref} download className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>Unduh PDF</a>
                </p>
              </div>
            ) : isTextFile ? (
              <div className="card" style={{ padding: 24 }}>
                {text === null ? (
                  <p role="status" style={{ color: "#74746d", margin: 0 }}>Memuat isi file…</p>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 14, lineHeight: 1.7 }}>{text}</pre>
                )}
                <p style={{ margin: "16px 0 0" }}>
                  <a href={fileHref} download className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>Unduh file</a>
                </p>
              </div>
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <p style={{ margin: "0 0 14px", color: "#74746d" }}>
                  {mime === "application/epub+zip"
                    ? "Reader EPUB belum tersedia. Unduh file lalu buka dengan aplikasi e-book."
                    : "Pratinjau untuk format ini belum tersedia. Silakan unduh file."}
                </p>
                <a href={fileHref} download className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>Unduh file</a>
              </div>
            )}
          </article>
        ) : null}
      </main>
    </div>
  );
}
