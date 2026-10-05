"use client";

// Kartu buku populer di landing (publik): 4 kartu warna ala contoh,
// data dari /api/portal/popular-books. Klik kartu -> halaman /buku.
import Image from "next/image";
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
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {rows.length === 0
          ? TAGS.map((t, i) => (
              <div key={t} className="card" style={{ padding: 22, minHeight: 190, opacity: 0.7 }}>
                <span style={{ fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase", color: "#74746d" }}>{t}</span>
                <p style={{ color: "#74746d", fontSize: 13, margin: "10px 0 0" }}>
                  {popular.data ? "Rak sedang kosong." : "Memuat…"}
                </p>
              </div>
            ))
          : rows.slice(0, 4).map((b, i) => (
              <Reveal key={`${b.title}-${i}`} delay={i * 90}>
                <a href="/buku" style={{ textDecoration: "none", color: "inherit" }}>
                  <article className="card-lift" style={{ background: b.color, borderRadius: 24, overflow: "hidden", minHeight: 250, display: "flex", flexDirection: "column" }}>
                    {b.coverUrl ? (
                      <div style={{ position: "relative", height: 140 }}>
                        <Image src={b.coverUrl} alt={`Sampul ${b.title}`} fill style={{ objectFit: "cover" }} sizes="(max-width: 640px) 100vw, 300px" />
                      </div>
                    ) : (
                      <div style={{ height: 140, display: "grid", placeItems: "center", fontSize: 44, borderBottom: "1px solid rgba(23,23,22,.15)" }} aria-hidden="true">✎</div>
                    )}
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <span style={{ fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase", opacity: 0.7 }}>{b.subject}</span>
                      <strong style={{ fontSize: 14, letterSpacing: "-0.02em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.title}</strong>
                      <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700 }}>Lihat rak ↗</span>
                    </div>
                  </article>
                </a>
              </Reveal>
            ))}
      </div>
      <div style={{ marginTop: 18 }}>
        <a href="/buku" className="btn-sticker" style={{ background: "#fffdf8", color: "#171716", borderColor: "#fffdf8", textDecoration: "none" }}>
          Buka rak ebook ↗
        </a>
      </div>
    </div>
  );
}
