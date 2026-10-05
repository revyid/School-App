"use client";

// Logo publik (landing/login/buku, tanpa login): coba gambar /api/portal/logo;
// bila sekolah belum upload (404) -> wordmark default via onError.
import { useState } from "react";
import Logo from "./Logo";

export default function PublicLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <Logo compact={compact} light={light} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/api/portal/logo"
      alt="Logo sekolah"
      width={compact ? 24 : 28}
      height={compact ? 24 : 28}
      style={{ borderRadius: 8, objectFit: "cover" }}
      onError={() => setOk(false)}
    />
  );
}
