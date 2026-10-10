"use client";

import Link from "next/link";
import PublicLogo from "./PublicLogo";
import AuthCta from "@/app/(portal)/AuthCta";

export default function PublicHeader({ schoolName }: { schoolName: string }) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px clamp(20px, 6vw, 88px)",
        borderBottom: "1px solid rgba(23,23,22,.14)",
        background: "rgba(247, 244, 236, 0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        flexWrap: "wrap",
      }}
    >
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <PublicLogo name={schoolName} />
      </Link>
      <nav
        style={{
          display: "flex",
          gap: 16,
          marginLeft: "auto",
          alignItems: "center",
          fontSize: 13,
          fontWeight: 700,
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "#575752", textDecoration: "none" }}>
          Portal
        </Link>
        <Link href="/perkakas" style={{ color: "#575752", textDecoration: "none" }}>
          Tools 🛠️
        </Link>
        <Link href="/perkakas/peta" style={{ color: "#575752", textDecoration: "none" }}>
          Peta 🗺️
        </Link>
        <Link href="/perkakas/buku" style={{ color: "#575752", textDecoration: "none" }}>
          Rak Buku 📚
        </Link>
        <Link href="/anonim" style={{ color: "#e85e43", textDecoration: "none" }}>
          Pesan Anonim ✉
        </Link>
        <AuthCta
          className="btn-sticker"
          style={{ background: "#171716", color: "#fffdf8", textDecoration: "none", padding: "8px 16px", fontSize: 12 }}
        />
      </nav>
    </header>
  );
}
