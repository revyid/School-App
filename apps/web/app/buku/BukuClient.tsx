"use client";

import PublicHeader from "@/components/PublicHeader";
import Reveal from "@/components/Reveal";
import BookManagerSheet, { type SchoolBook } from "@/components/BookManagerSheet";
import BookThumb from "@/components/BookThumb";
import { useFetch } from "@/app/lib/api";
import { useState } from "react";
import { BookOpenIcon } from "lucide-react";
import { useTrackView } from "@/app/lib/use-track-view";

const SOURCE_LABEL: Record<SchoolBook["source"], string> = {
  LINK: "Tautan",
  UPLOAD: "Berkas",
  MARKDOWN: "Teks",
};

export default function BukuClient({ schoolName }: { schoolName: string }) {
  useTrackView("PORTAL", "buku");

  // Perpustakaan sekolah — satu-satunya koleksi di halaman ini.
  const schoolBooks = useFetch<{ rows: SchoolBook[] }>("/api/books?scope=school&perPage=24");
  const me = useFetch<{ user: { role: string } }>("/api/auth/me");
  const role = me.data?.user.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const [sheetOpen, setSheetOpen] = useState(false);

  const schoolRows = (schoolBooks.data?.rows ?? []).filter((b) => isAdmin || b.published);

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      <PublicHeader schoolName={schoolName} />

      <main style={{ padding: "clamp(28px, 5vw, 64px) clamp(20px, 6vw, 88px) 72px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
            <div>
              <p className="kicker">Perpustakaan Sekolah</p>
              <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 64px)", margin: "8px 0 10px" }}>
                Buku <span style={{ color: "#e85e43" }}>sekolah.</span>
              </h1>
              <p style={{ color: "#74746d", maxWidth: 580 }}>
                E-book & materi pelajaran yang dipilih sekolah. Buka untuk membaca langsung.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="btn-sticker btn-primary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <BookOpenIcon className="size-4" />
              {isAdmin ? "Kelola buku" : "Lihat daftar"}
            </button>
          </div>
        </Reveal>

        <div style={{ marginTop: 34 }} aria-live="polite">
          {schoolBooks.loading ? (
            <p role="status" style={{ color: "#74746d" }}>Memuat koleksi…</p>
          ) : schoolBooks.error ? (
            <div className="card" style={{ padding: 28 }}>
              <p className="m-0 mb-2.5 text-sm" style={{ color: "#74746d" }}>Masuk dulu untuk melihat koleksi buku sekolah.</p>
              <a href={`/login?next=${encodeURIComponent("/buku")}`} className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>
                Masuk
              </a>
            </div>
          ) : schoolRows.length === 0 ? (
            <div className="card" style={{ padding: 28 }}>
              <p style={{ color: "#74746d", margin: 0 }}>
                {isAdmin ? "Belum ada buku. Klik \"Kelola buku\" untuk menambah." : "Rak sedang kosong."}
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
              {schoolRows.map((b, i) => (
                <Reveal key={b.id} delay={(i % 4) * 80}>
                  <a
                    href={`/buku/${b.id}`}
                    className="card hover:shadow-lg"
                    style={{ display: "flex", gap: 12, padding: 14, textDecoration: "none", color: "inherit", height: "100%" }}
                  >
                    <BookThumb src={b.coverUrl} title={b.title} className="h-20 w-14" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", color: "#74746d", textTransform: "uppercase" }}>
                        {SOURCE_LABEL[b.source]}{b.published === false ? " · Draf" : ""}
                      </span>
                      <strong style={{ fontSize: 14.5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {b.title}
                      </strong>
                      {b.author && <small style={{ color: "#74746d" }}>{b.author}</small>}
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </main>

      <BookManagerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        books={schoolRows}
        loading={schoolBooks.loading}
        canManage={isAdmin}
        onChanged={() => void schoolBooks.reload()}
      />
    </div>
  );
}
