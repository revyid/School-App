"use client";

// Primitif UI dasbor ala edukids: judul halaman editorial, kartu stat,
// tabel hangat, field form, lencana status, tombol. Satu gaya untuk semua
// halaman fitur (siswa/guru/admin) — ganti <h1>/<table> mentah.
import * as React from "react";

export function PageHead({ kicker, title, desc, right }: { kicker: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", justifyContent: "space-between", gap: 14, marginBottom: 20 }}>
      <div>
        <p className="kicker" style={{ margin: "0 0 8px" }}>{kicker}</p>
        <h1 className="display" style={{ fontSize: "clamp(28px, 3.4vw, 42px)", margin: 0 }}>{title}</h1>
        {desc && <p style={{ color: "#74746d", margin: "8px 0 0", maxWidth: 560, fontSize: 13.5 }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function SegStat({ stats }: { stats: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginBottom: 20 }}>
      {stats.map((s) => (
        <div key={s.label} className="card card-lift" style={{ padding: "14px 16px" }}>
          <p style={{ fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase", color: "#74746d", margin: "0 0 4px" }}>{s.label}</p>
          <p className="display" style={{ fontSize: 26, margin: 0 }}>
            {s.value}
            {s.accent && <span style={{ color: "#e85e43" }}>{s.accent}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="card" style={{ padding: "clamp(16px, 2.5vw, 26px)", ...style }}>
      {children}
    </section>
  );
}

export function WarmTable({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid rgba(23,23,22,.14)", borderRadius: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
        <thead>
          <tr style={{ background: "#eeeadd" }}>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontFamily: "var(--font-meta)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".08em", color: "#74746d", whiteSpace: "nowrap" }}>{h}</th>
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

export function Btn({ kind = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "ghost" | "dark" }) {
  const cls = kind === "primary" ? "btn-sticker btn-primary" : kind === "dark" ? "btn-sticker" : "btn-sticker btn-ghost";
  const dark = kind === "dark" ? { background: "#171716", color: "#fffdf8" } : {};
  return <button {...props} className={`${cls} ${props.className ?? ""}`} style={{ textDecoration: "none", ...dark, ...(props.style as object ?? {}) }} />;
}

export function LinkBtn({ kind = "ghost", ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { kind?: "primary" | "ghost" | "dark" }) {
  const cls = kind === "primary" ? "btn-sticker btn-primary" : kind === "dark" ? "btn-sticker" : "btn-sticker btn-ghost";
  const dark = kind === "dark" ? { background: "#171716", color: "#fffdf8" } : {};
  return <a {...props} className={`${cls} ${props.className ?? ""}`} style={{ textDecoration: "none", ...dark, ...(props.style as object ?? {}) }} />;
}

const BADGE: Record<string, { bg: string; fg: string }> = {
  HADIR: { bg: "#aec6a4", fg: "#171716" },
  SUDAH: { bg: "#aec6a4", fg: "#171716" },
  AKTIF: { bg: "#aec6a4", fg: "#171716" },
  IZIN: { bg: "#97c4db", fg: "#171716" },
  SAKIT: { bg: "#f5c94a", fg: "#171716" },
  BELUM: { bg: "#eeeadd", fg: "#74746d" },
  ALPHA: { bg: "#e85e43", fg: "#fffdf8" },
  TERLAMBAT: { bg: "#f5c94a", fg: "#171716" },
  TUTUP: { bg: "#eeeadd", fg: "#74746d" },
  PENDING: { bg: "#f5c94a", fg: "#171716" },
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

export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#74746d", fontSize: 13 }}>{children}</p>;
}

export function Err({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#c94b35", fontSize: 13, fontWeight: 700 }}>{children}</p>;
}
