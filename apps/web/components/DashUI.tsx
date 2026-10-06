"use client";

// Primitif UI dasbor ala edukids — playful: eyebrow dot, spark dekoratif,
// icon rotate, metric-bars, streak dots, badge warna cerah.
import * as React from "react";

import ClickSpark from "./ClickSpark";
import { IconStar } from "./Icons";

// ---------- PageHead ----------
export function PageHead({
  kicker,
  title,
  desc,
  right,
  spark,
}: {
  kicker: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
  /** Emoji/glyph dekoratif melayang di sisi kanan judul */
  spark?: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: 14, marginBottom: 24, position: "relative" }}>
      <div style={{ position: "relative" }}>
        {/* Eyebrow dengan dot hidup */}
        <p className="kicker" style={{ margin: "0 0 10px", display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85e43", boxShadow: "0 0 0 4px rgba(232,94,67,.14)", flexShrink: 0 }} />
          {kicker}
        </p>
        <h1 className="display" style={{ fontSize: "clamp(28px, 3.4vw, 44px)", margin: 0, letterSpacing: "-0.05em" }}>
          {title}
          {spark && (
            <span
            aria-hidden="true"
            className="anim-drift"
            style={{ marginLeft: 12, display: "inline-block", verticalAlign: "middle", opacity: 0.7 }}
          >
            <IconStar size={Math.round(0.65 * 44)} color="#e85e43" />
          </span>
          )}
        </h1>
        {desc && <p style={{ color: "#74746d", margin: "9px 0 0", maxWidth: 560, fontSize: 13.5, lineHeight: 1.7 }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- SegStat (metric cards ala edukids) ----------
const STAT_ACCENTS = ["#aec6a4", "#f5c94a", "#97c4db", "#e85e43"];
const STAT_ICONS = ["✦", "◎", "✳", "★"];

export function SegStat({ stats }: { stats: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", marginBottom: 24 }}>
      {stats.map((s, i) => {
        const bg = s.accent ?? STAT_ACCENTS[i % STAT_ACCENTS.length];
        const dark = bg === "#e85e43" || bg === "#50643e";
        return (
          <div
            key={s.label}
            className="card card-lift"
            style={{
              padding: "18px 16px",
              background: bg,
              border: "none",
              position: "relative",
              overflow: "hidden",
              minHeight: 110,
            }}
          >
            {/* Dekoratif glyph */}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: 12,
                bottom: 10,
                fontSize: 32,
                opacity: 0.15,
                fontFamily: "var(--font-display)",
                transform: "rotate(12deg)",
                pointerEvents: "none",
              }}
            >
              {STAT_ICONS[i % STAT_ICONS.length]}
            </span>
            <p style={{ fontFamily: "var(--font-meta)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: dark ? "rgba(255,253,248,.7)" : "#74746d", margin: "0 0 10px" }}>{s.label}</p>
            <p className="display" style={{ fontSize: 32, margin: 0, lineHeight: 0.9, letterSpacing: "-0.1em", color: dark ? "#fffdf8" : "#171716" }}>
              {s.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Panel ----------
export function Panel({ children, style, deco }: { children: React.ReactNode; style?: React.CSSProperties; deco?: boolean }) {
  return (
    <section className="card" style={{ padding: "clamp(16px, 2.5vw, 26px)", position: "relative", overflow: deco ? "hidden" : undefined, ...style }}>
      {deco && (
        <span aria-hidden="true" style={{ position: "absolute", right: 18, top: 18, fontSize: 38, opacity: 0.07, transform: "rotate(18deg)", pointerEvents: "none" }}>✦</span>
      )}
      {children}
    </section>
  );
}

// ---------- WarmTable ----------
export function WarmTable({ head, children, minW = 560 }: { head: string[]; children: React.ReactNode; minW?: number }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid rgba(23,23,22,.14)", borderRadius: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: minW > 0 ? minW : undefined }}>
        <thead>
          <tr style={{ background: "#eeeadd" }}>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".09em", color: "#74746d", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function warmCell(extra?: React.CSSProperties): React.CSSProperties {
  return { padding: "10px 14px", borderTop: "1px solid rgba(23,23,22,.1)", verticalAlign: "top", ...extra };
}

// ---------- Form primitives ----------
const fieldStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(23,23,22,.25)",
  background: "#fffdf8",
  padding: "9px 14px",
  fontSize: 14,
  color: "#171716",
  width: "100%",
};

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...(props.style as object ?? {}) }} />;
}

export function TextSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, width: "auto", ...(props.style as object ?? {}) }} />;
}

// ---------- Buttons ----------
export function Btn({ kind = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "dark" }) {
  const cls = kind === "primary" ? "btn-sticker btn-primary" : kind === "dark" ? "btn-sticker" : "btn-sticker btn-ghost";
  const dark = kind === "dark" ? { background: "#171716", color: "#fffdf8" } : {};
  
  // Micro-interaction spark hanya untuk tombol primer atau dark (action utama)
  if (kind === "primary" || kind === "dark") {
    return (
      <ClickSpark sparkColor="#e85e43" sparkSize={6} sparkRadius={20} sparkCount={6} duration={400}>
        <button {...props} className={`${cls} ${props.className ?? ""}`} style={{ textDecoration: "none", ...dark, ...(props.style as object ?? {}) }} />
      </ClickSpark>
    );
  }
  
  return <button {...props} className={`${cls} ${props.className ?? ""}`} style={{ textDecoration: "none", ...dark, ...(props.style as object ?? {}) }} />;
}

export function LinkBtn({ kind = "ghost", ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { kind?: "primary" | "ghost" | "dark" }) {
  const cls = kind === "primary" ? "btn-sticker btn-primary" : kind === "dark" ? "btn-sticker" : "btn-sticker btn-ghost";
  const dark = kind === "dark" ? { background: "#171716", color: "#fffdf8" } : {};
  return <a {...props} className={`${cls} ${props.className ?? ""}`} style={{ textDecoration: "none", ...dark, ...(props.style as object ?? {}) }} />;
}

// ---------- Badge ----------
const BADGE: Record<string, { bg: string; fg: string }> = {
  HADIR:    { bg: "#aec6a4", fg: "#171716" },
  SUDAH:    { bg: "#aec6a4", fg: "#171716" },
  AKTIF:    { bg: "#aec6a4", fg: "#171716" },
  IZIN:     { bg: "#97c4db", fg: "#171716" },
  SAKIT:    { bg: "#f5c94a", fg: "#171716" },
  BELUM:    { bg: "#eeeadd", fg: "#74746d" },
  ALPHA:    { bg: "#e85e43", fg: "#fffdf8" },
  TERLAMBAT:{ bg: "#f5c94a", fg: "#171716" },
  TUTUP:    { bg: "#eeeadd", fg: "#74746d" },
  PENDING:  { bg: "#f5c94a", fg: "#171716" },
  APPROVED: { bg: "#aec6a4", fg: "#171716" },
  REJECTED: { bg: "#e85e43", fg: "#fffdf8" },
  NONAKTIF: { bg: "#eeeadd", fg: "#74746d" },
};

export function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  const b = BADGE[status.toUpperCase()] ?? { bg: "#eeeadd", fg: "#74746d" };
  return (
    <span style={{ display: "inline-block", background: b.bg, color: b.fg, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {children ?? status}
    </span>
  );
}

// ---------- Toolbar / Note / Err ----------
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "#74746d", fontSize: 13, display: "flex", alignItems: "flex-start", gap: 6 }}>
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#74746d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </span>
      {children}
    </p>
  );
}

export function Err({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: "#c94b35", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "flex-start", gap: 6 }}>
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c94b35" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
      {children}
    </p>
  );
}
