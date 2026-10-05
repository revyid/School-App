"use client";

// Kartu buku populer di landing (publik): 4 kartu warna ala contoh,
// data dari /api/portal/popular-books. Klik kartu -> halaman /buku.
import { useFetch } from "@/app/lib/api";
import Reveal from "@/components/Reveal";

type Book = {
  title: string;
  authors: string[];
  year?: number;
  infoUrl?: string;
  coverUrl?: string;
  subject: string;
  color: string;
};

const TAGS = ["Cerita", "Sains", "Aktivitas", "Dunia"];

export default function PopularBooks() {
  const popular = useFetch<{ rows: Book[] }>("/api/portal/popular-books");
  const rows = popular.data?.rows ?? [];

  if (!popular.data && popular.error) return null;

  return (
    <div>
      <div className="ebook-shelf">
        {rows.length === 0
          ? TAGS.map((t) => (
              <div key={t} className="ebook-card" style={{ background: "#eeeadd" }}>
                <span className="book-tag">{t}</span>
                <strong>{popular.data ? "Rak sedang kosong." : "Memuat…"}</strong>
                <small> </small>
                <span className="book-arrow">↗</span>
              </div>
            ))
          : rows.slice(0, 4).map((b, i) => {
              const author = (b.authors ?? [])[0];
              return (
                <Reveal key={`${b.title}-${i}`} delay={i * 90}>
                  <a href="/buku" className="ebook-card" style={{ background: b.color, textDecoration: "none" }}>
                    <span className="book-tag">{b.subject}</span>
                    <strong>{b.title}</strong>
                    <small>{author ? `oleh ${author}` : b.year ? `terbit ${b.year}` : " "}</small>
                    <span className="book-arrow">↗</span>
                  </a>
                </Reveal>
              );
            })}
      </div>
      <div style={{ marginTop: 18 }}>
        <a href="/buku" className="btn-sticker" style={{ background: "#fffdf8", color: "#171716", borderColor: "#fffdf8", textDecoration: "none" }}>
          Buka rak ebook ↗
        </a>
      </div>
    </div>
  );
}
