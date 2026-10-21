"use client";

// Logo sekolah di dasbor (sudah login): coba gambar /api/portal/logo;
// bila belum ada (404) -> ikon matahari default.
// Nama sekolah SELALU ditampilkan sebagai teks di samping ikon, baik logo
// custom ada maupun tidak (perubahan: dulu teks hilang saat gambar gagal).
import { useState } from "react";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

// object-contain: gambar tetap utuh (tidak terpotong), proporsi native
// terjaga. object-cover (sebelumnya) memotong bagian tepi logo.
export default function SchoolLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  const displayText = name || "lacakedu";

  // Saat logo custom gagal dimuat, serahkan ke Logo default yang SUDAH
  // menyertakan teks nama sekolah — jangan render teks dua kali.
  if (!ok) return <Logo compact={compact} light={light} name={displayText} />;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", light ? "text-cream" : "text-ink")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/portal/logo"
        alt={displayText}
        width={compact ? 24 : 28}
        height={compact ? 24 : 28}
        className="shrink-0 rounded-lg object-contain"
        onError={() => setOk(false)}
      />
      <span className={cn("overflow-hidden text-ellipsis whitespace-nowrap font-extrabold tracking-[-0.04em]", compact ? "text-base" : "text-[18px]")}>
        {displayText}
      </span>
    </span>
  );
}
