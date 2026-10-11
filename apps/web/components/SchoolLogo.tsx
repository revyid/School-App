"use client";

// Logo sekolah di dasbor (sudah login): coba gambar /api/portal/logo;
// bila belum ada (404) -> ikon matahari default.
// Nama sekolah SELALU ditampilkan sebagai teks di samping ikon, baik logo
// custom ada maupun tidak (perubahan: dulu teks hilang saat gambar gagal).
import { useState } from "react";
import Logo from "./Logo";

export default function SchoolLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  const displayText = name || "sms-lms";

  // Saat logo custom gagal dimuat, serahkan ke Logo default yang SUDAH
  // menyertakan teks nama sekolah — jangan render teks dua kali.
  if (!ok) return <Logo compact={compact} light={light} name={displayText} />;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: light ? "#fffdf8" : "#171716", minWidth: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/portal/logo"
        alt={displayText}
        width={compact ? 24 : 28}
        height={compact ? 24 : 28}
        style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        onError={() => setOk(false)}
      />
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "-0.04em",
          fontSize: compact ? 16 : 18,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayText}
      </span>
    </span>
  );
}
