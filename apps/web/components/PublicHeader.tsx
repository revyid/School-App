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
import { cn } from "@/lib/utils";

import { MenuIcon, XIcon } from "lucide-react";

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
      className="sticky top-0 z-40 flex min-h-[72px] flex-nowrap items-center gap-4 border-b border-line bg-paper/95 px-[clamp(16px,4vw,88px)] py-[14px] backdrop-blur-[12px]"
    >
      <Link className="no-underline shrink-0 min-w-[0px]" href="/">
        <PublicLogo name={schoolName} />
      </Link>

      {/* Tautan lebar (desktop) — 1 baris, tanpa wrap, mengecil otomatis */}
      <nav
        className="public-nav ml-auto flex min-w-0 flex-nowrap items-center gap-[clamp(12px,2vw,26px)] overflow-hidden whitespace-nowrap text-[12.5px] font-bold"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn("shrink-0 no-underline", n.accent ? "text-terracotta-deep" : "text-muted-strong")}
          >
            {n.label}
          </Link>
        ))}
        <AuthCta
          className="btn-sticker bg-ink text-cream no-underline pt-2 pr-4 pb-2 pl-4 min-h-[38px] text-xs shrink-0"
        />
      </nav>

      {/* Burger + dropdown (mobile) */}
      <div ref={boxRef} className="public-burger relative ml-auto shrink-0">
        <button className="grid place-items-center w-[40px] h-[40px] border border-solid border-ink rounded-full bg-cream cursor-pointer text-base"
          type="button"
          aria-label="Buka menu navigasi"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <XIcon size={18} aria-hidden="true" /> : <MenuIcon size={18} aria-hidden="true" />}
        </button>
        {open && (
          <nav
            className="absolute right-0 top-12 z-50 flex min-w-[210px] flex-col gap-1 rounded-2xl border border-ink bg-cream p-[10px] shadow-[0_8px_24px_rgba(23,23,22,.15)]"
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn("rounded-[10px] px-[14px] py-[10px] text-[13px] font-bold no-underline", n.accent ? "text-terracotta-deep" : "text-ink")}
              >
                {n.label}
              </Link>
            ))}
            <div className="pt-1.5 pr-[10px] pb-[2px] pl-[10px]">
              <AuthCta
                className="btn-sticker bg-ink text-cream no-underline w-full justify-center text-xs"
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
