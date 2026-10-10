"use client";

// Logo sekolah di dasbor (sudah login): coba gambar /api/portal/logo;
// bila belum ada (404) -> logo ikon default via onError.
// Selalu tampilkan teks nama sekolah baik ada gambar logo maupun tidak.
import { useState } from "react";
import Logo from "./Logo";

export default function SchoolLogo({ compact = false, light = false, name }: { compact?: boolean; light?: boolean; name?: string }) {
  const [ok, setOk] = useState(true);
  const displayText = name || "sms-lms";
  const ink = light ? "#fffdf8" : "#171716";

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: ink, minWidth: 0 }}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/api/portal/logo"
          alt={displayText}
          width={compact ? 24 : 28}
          height={compact ? 24 : 28}
          style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          onError={() => setOk(false)}
        />
      ) : (
        <Logo compact={compact} light={light} name={name} />
      )}
      {ok && (
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
      )}
    </span>
  );
}
