"use client";
import React from "react";

/**
 * Glif vektor kecil pengganti karakter tipografi (✳ ✦ ☼ ↗ ✕ ☰ ↓ ↑).
 * Karakter Unicode tersebut sering merender tidak konsisten antar perangkat
 * dan memberi kesan "AI slop", jadi diganti ikon SVG yang deterministik.
 */
export type GlyphName =
  | "arrowUpRight"
  | "arrowRight"
  | "arrowDown"
  | "arrowUp"
  | "arrowDownArrow"
  | "close"
  | "menu"
  | "spark"
  | "sun"
  | "infinity"
  | "sigma"
  | "textAa"
  | "target"
  | "mail"
  | "download";

const PATHS: Record<GlyphName, React.ReactElement> = {
  arrowUpRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </>
  ),
  arrowDownArrow: (
    <>
      <path d="M12 4v16" />
      <path d="M6 10l6-6 6 6" />
      <path d="M6 14l6 6 6-6" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  spark: (
    <path d="M12 3l2.2 6.3L20.5 11.5 14.2 13.7 12 20l-2.2-6.3L3.5 11.5 9.8 9.3z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </>
  ),
  infinity: (
    <path d="M8.2 8.2a3.8 3.8 0 1 0 0 7.6c2.4 0 3.2-1.9 3.8-3.8.6-1.9 1.4-3.8 3.8-3.8a3.8 3.8 0 1 1 0 7.6c-2.4 0-3.2-1.9-3.8-3.8-.6-1.9-1.4-3.8-3.8-3.8z" />
  ),
  sigma: <path d="M17 5H7l5 7-5 7h10" />,
  textAa: (
    <>
      <path d="M4 18 9 6l5 12" />
      <path d="M5.8 14.4h6.4" />
      <path d="M15 18l3-8 3 8" />
      <path d="M16.2 15.4h5.6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.9" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.4" />
      <path d="M3.8 7.2 12 13l8.2-5.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </>
  ),
};

export function Glyph({
  name,
  size = 16,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

/** Ikon berbentuk bulatan (latar lingkaran + glif), untuk kartu fitur. */
export function GlyphBadge({
  name,
  size = 34,
  box = 73,
  border = "1px solid currentColor",
}: {
  name: GlyphName;
  size?: number;
  box?: number;
  border?: string;
}) {
  return (
    <div
      className="grid place-items-center rounded-full"
      // dynamic: ukuran kotak + border dari prop runtime
      style={{ width: box, height: box, border }}
    >
      <Glyph name={name} size={size} />
    </div>
  );
}
