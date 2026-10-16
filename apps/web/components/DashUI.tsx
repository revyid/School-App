"use client";

// Primitif UI dasbor ala edukids — playful: eyebrow dot, spark dekoratif,
// icon rotate, metric-bars, streak dots, badge warna cerah.
// Basis: komponen shadcn/Base UI di components/ui (Input, Table) + token edukids.
import * as React from "react";

import { IconStar } from "./Icons";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
    <div className="relative mb-6 flex flex-wrap items-end justify-between gap-3.5">
      <div className="relative">
        {/* Eyebrow dengan dot hidup */}
        <p className="kicker mb-2.5">
          {kicker}
        </p>
        <h1 className="display m-0" style={{ fontSize: "clamp(28px, 3.4vw, 44px)", letterSpacing: "-0.05em" }}>
          {title}
          {spark && (
            <span
            aria-hidden="true"
            className="anim-drift ml-3 inline-block align-middle text-terracotta opacity-70"
          >
            {/* currentColor: atribut stroke SVG tidak mendukung var() */}
            <IconStar size={Math.round(0.65 * 44)} />
          </span>
          )}
        </h1>
        {desc && <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-[1.7] text-muted" style={{ margin: "9px 0 0" }}>{desc}</p>}
      </div>
      {right}
    </div>
  );
}

// ---------- SegStat (metric cards ala edukids) ----------
const STAT_ACCENTS = ["var(--color-mint)", "var(--color-sun)", "var(--color-sky)", "var(--color-terracotta)"];
const STAT_DARK = new Set(["var(--color-terracotta)", "var(--color-olive-deep)"]);
const STAT_ICONS = ["", "", "", ""];

export function SegStat({ stats }: { stats: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))" }}>
      {stats.map((s, i) => {
        const bg = s.accent ?? STAT_ACCENTS[i % STAT_ACCENTS.length];
        const dark = STAT_DARK.has(bg);
        return (
          <div
            key={s.label}
            className="card card-lift relative min-h-[110px] overflow-hidden border-none px-4 py-[18px]"
            style={{ background: bg }}
          >
            {/* Dekoratif glyph */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 right-3 rotate-12 text-[32px] opacity-[0.15]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {STAT_ICONS[i % STAT_ICONS.length]}
            </span>
            <p className="m-0 mb-2.5 text-[9px] uppercase tracking-[0.08em]" style={{ fontFamily: "var(--font-meta)", color: dark ? "rgba(255,253,248,.7)" : "var(--color-muted)" }}>{s.label}</p>
            <p className="display m-0 text-[32px] leading-[0.9] tracking-[-0.1em]" style={{ color: dark ? "var(--color-cream)" : "var(--color-ink)" }}>
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
    <section className={cn("card relative px-[clamp(16px,2.5vw,26px)] py-[clamp(16px,2.5vw,26px)]", deco && "overflow-hidden")} style={style}>
      {deco && (
        <span aria-hidden="true" className="pointer-events-none absolute right-[18px] top-[18px] rotate-[18deg] text-[38px] opacity-[0.07]" />
      )}
      {children}
    </section>
  );
}

// ---------- WarmTable (basis: components/ui/table) ----------
export function WarmTable({ head, children, minW = 560, className }: { head: string[]; children: React.ReactNode; minW?: number; className?: string }) {
  return (
    <div className={cn("warm-table overflow-x-auto rounded-2xl border border-line", className)}>
      <Table className="text-[13.5px]" style={{ minWidth: minW > 0 ? minW : undefined }}>
        <TableHeader>
          <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
            {head.map((h) => (
              <TableHead key={h} className="whitespace-nowrap text-[10px] tracking-[.09em] text-muted">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function warmCell(extra?: React.CSSProperties): React.CSSProperties {
  return { padding: "10px 14px", borderTop: "1px solid var(--color-line)", verticalAlign: "top", ...extra };
}

// ---------- Form primitives (basis: components/ui/input) ----------
export function TextInput(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} />;
}

// ---------- Toolbar / Note / Err ----------
export function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2.5">{children}</div>;
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] text-muted">
      <span aria-hidden="true" className="mt-px shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </span>
      {children}
    </p>
  );
}

export function Err({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] font-bold text-terracotta-dark">
      <span aria-hidden="true" className="mt-px shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </span>
      {children}
    </p>
  );
}
