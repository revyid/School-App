"use client";

// Logo sekolah di dasbor (sudah login): coba gambar /api/portal/logo;
// bila belum ada (404) -> wordmark default via onError.
import { useState } from "react";
import Logo from "./Logo";

export default function SchoolLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <Logo compact={compact} light={light} name={name} />;
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
