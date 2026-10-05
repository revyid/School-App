// Wordmark SMS-LMS: matahari kecil + teks (teks di HTML, bukan gambar).
// Bila `src` diisi (logo sekolah dari /api/portal/logo), gambar logo dipakai.
export default function Logo({ compact = false, light = false, src = null as string | null }) {
  const ink = light ? "#fffdf8" : "#171716";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: ink }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Logo sekolah" width={compact ? 24 : 28} height={compact ? 24 : 28} style={{ borderRadius: 8, objectFit: "cover" }} />
      ) : (
      <svg width={compact ? 24 : 28} height={compact ? 24 : 28} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="18" r="9" fill="none" stroke={ink} strokeWidth="2.4" />
        <circle cx="16" cy="18" r="3.2" fill="#e85e43" />
        <g stroke={ink} strokeWidth="2.2" strokeLinecap="round">
          <line x1="16" y1="2.5" x2="16" y2="6" />
          <line x1="7.5" y1="5.5" x2="10" y2="8" />
          <line x1="24.5" y1="5.5" x2="22" y2="8" />
        </g>
      </svg>
      )}
      <span style={{ fontWeight: 800, letterSpacing: "-0.04em", fontSize: compact ? 17 : 19 }}>
        sms<span style={{ color: "#e85e43" }}>-lms</span>
      </span>
    </span>
  );
}
