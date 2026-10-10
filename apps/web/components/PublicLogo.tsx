"use client";

// Logo publik (landing/login/buku, tanpa login): coba gambar /api/portal/logo;
// bila sekolah belum upload (404) -> wordmark default via onError.
import { useState } from "react";
import Logo from "./Logo";

export default function PublicLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <Logo compact={compact} light={light} name={name} />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/api/portal/logo"
        alt="Logo sekolah"
        width={compact ? 24 : 28}
        height={compact ? 24 : 28}
        style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        onError={() => setOk(false)}
      />
      <span style={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: compact ? 16 : 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name || "sms-lms"}
      </span>
    </span>
  );
}
