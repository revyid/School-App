"use client";

import Link from "next/link";
import { useState } from "react";
import PublicLogo from "./PublicLogo";
import AuthCta from "@/app/(portal)/AuthCta";

const links = [
  ["/", "Portal"],
  ["/perkakas", "Tools"],
  ["/perkakas/peta", "Peta"],
  ["/buku", "Rak Buku"],
  ["/anonim", "Pesan Anonim"],
] as const;

export default function PublicHeader({ schoolName }: { schoolName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-header" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px clamp(20px, 6vw, 88px)", borderBottom: "1px solid rgba(23,23,22,.14)", background: "rgba(247,244,236,.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 40, flexWrap: "wrap" }}>
      <Link href="/" onClick={() => setOpen(false)} style={{ textDecoration: "none", color: "inherit" }}><PublicLogo name={schoolName} /></Link>
      <button type="button" className="public-menu-button" aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>☰ <span>Menu</span></button>
      <nav aria-label="Navigasi publik" className={`public-nav${open ? " is-open" : ""}`}>
        {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
        <AuthCta className="btn-sticker" style={{ background: "#171716", color: "#fffdf8", textDecoration: "none", padding: "8px 16px", fontSize: 12, flexShrink: 0 }} />
      </nav>
      <style>{`
        .public-nav { display:flex; gap:14px; margin-left:auto; align-items:center; font-size:12.5px; font-weight:700; flex-wrap:nowrap; white-space:nowrap; overflow-x:auto; scrollbar-width:none; }
        .public-nav::-webkit-scrollbar { display:none; }
        .public-nav a { color:#575752; text-decoration:none; flex-shrink:0; }
        .public-nav a:nth-last-child(2) { color:#e85e43; }
        .public-menu-button { display:none; margin-left:auto; border:1px solid rgba(23,23,22,.25); background:#fffdf8; color:#171716; border-radius:999px; min-height:44px; padding:8px 13px; font-weight:700; }
        @media (max-width:760px) {
          .public-header { padding:12px 16px !important; }
          .public-menu-button { display:inline-flex; align-items:center; gap:6px; }
          .public-nav { display:none; width:100%; margin:0; padding:10px 0 2px; flex-direction:column; align-items:stretch; gap:4px; overflow:visible; }
          .public-nav.is-open { display:flex; }
          .public-nav a { padding:10px 12px; border-radius:10px; }
          .public-nav a:hover { background:#eeeadd; }
          .public-nav .btn-sticker { justify-content:center; margin-top:4px; }
        }
      `}</style>
    </header>
  );
}
