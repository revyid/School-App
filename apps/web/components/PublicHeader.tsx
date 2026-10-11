"use client";

// Header publik yang dipakai BERSAMA oleh semua halaman non-dasbor
// (portal, buku, perkakas/*, anonim, privasi, syarat, pantau, dll).
// Tujuannya konsistensi: nama sekolah + logo di kiri, tautan di kanan,
// dan TIDAK ADA lagi perbedaan layout antar halaman.
//
// Aturan supaya navbar tidak pernah meluap jadi 2 baris:
//   - tautan menggunakan font kecil dan white-space: nowrap
//   - di layar sedang tautan dikurangi ke yang penting
//   - di layar kecil (<760px) seluruh tautan masuk menu burger
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import PublicLogo from "./PublicLogo";
import AuthCta from "@/app/(portal)/AuthCta";

import { Glyph } from "./Glyph";
type NavItem = { href: string; label: string; accent?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Portal" },
  { href: "/perkakas", label: "Perkakas" },
  { href: "/perkakas/peta", label: "Peta" },
  { href: "/buku", label: "Buku Digital" },
  { href: "/anonim", label: "Pesan Anonim", accent: true },
];

export default function PublicHeader({ schoolName }: { schoolName: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Tutup menu saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px clamp(16px, 4vw, 88px)",
        borderBottom: "1px solid rgba(23,23,22,.14)",
        background: "rgba(247, 244, 236, 0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        flexWrap: "nowrap",
        minHeight: 72,
      }}
    >
      <Link href="/" style={{ textDecoration: "none", color: "inherit", flexShrink: 0, minWidth: 0 }}>
        <PublicLogo name={schoolName} />
      </Link>

      {/* Tautan lebar (desktop) — 1 baris, tanpa wrap, mengecil otomatis */}
      <nav
        className="public-nav"
        style={{
          display: "flex",
          gap: "clamp(12px, 2vw, 26px)",
          marginLeft: "auto",
          alignItems: "center",
          fontSize: 12.5,
          fontWeight: 700,
          flexWrap: "nowrap",
          whiteSpace: "nowrap",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            style={{ color: n.accent ? "#e85e43" : "#575752", textDecoration: "none", flexShrink: 0 }}
          >
            {n.label}
          </Link>
        ))}
        <AuthCta
          className="btn-sticker"
          style={{
            background: "#171716",
            color: "#fffdf8",
            textDecoration: "none",
            padding: "8px 16px",
            minHeight: 38,
            fontSize: 12,
            flexShrink: 0,
          }}
        />
      </nav>

      {/* Burger + dropdown (mobile) */}
      <div ref={boxRef} className="public-burger" style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}>
        <button
          type="button"
          aria-label="Buka menu navigasi"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            border: "1px solid #171716",
            borderRadius: "50%",
            background: "#fffdf8",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          {open ? <Glyph name="close" size={18} /> : <Glyph name="menu" size={18} />}
        </button>
        {open && (
          <nav
            style={{
              position: "absolute",
              right: 0,
              top: 48,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 210,
              padding: 10,
              background: "#fffdf8",
              border: "1px solid #171716",
              borderRadius: 16,
              boxShadow: "0 8px 24px rgba(23,23,22,.15)",
              zIndex: 50,
            }}
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  color: n.accent ? "#e85e43" : "#171716",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {n.label}
              </Link>
            ))}
            <div style={{ padding: "6px 10px 2px" }}>
              <AuthCta
                className="btn-sticker"
                style={{
                  background: "#171716",
                  color: "#fffdf8",
                  textDecoration: "none",
                  width: "100%",
                  justifyContent: "center",
                  fontSize: 12,
                }}
              />
            </div>
          </nav>
        )}
      </div>

      <style>{`
        .public-burger { display: none; }
        @media (max-width: 900px) {
          .public-nav { display: none !important; }
          .public-burger { display: block !important; }
        }
      `}</style>
    </header>
  );
}
