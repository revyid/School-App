"use client";

// Logo publik (landing/login/buku, tanpa login): coba gambar /api/portal/logo;
// bila sekolah belum upload (404) -> wordmark default via onError.
// Nama sekolah SELALU tampil di samping ikon (logo = gambar + teks).
import { useState } from "react";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

export default function PublicLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  const displayText = name || "lacakedu";

  // Logo default sudah menyertakan teks; jangan render teks dua kali.
  if (!ok) return <Logo compact={compact} light={light} name={displayText} />;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", light ? "text-cream" : "text-ink")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/portal/logo"
        alt={displayText}
        width={compact ? 24 : 28}
        height={compact ? 24 : 28}
        className="shrink-0 rounded-lg object-cover"
        onError={() => setOk(false)}
      />
      <span className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-extrabold tracking-[-0.04em]", compact ? "text-base" : "text-[18px]")}>
        {displayText}
      </span>
    </span>
  );
}
