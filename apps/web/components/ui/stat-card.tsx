"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Kartu metrik bergaris warna (basis: ui/card).
const STAT_ACCENTS = ["var(--color-mint)", "var(--color-sun)", "var(--color-sky)", "var(--color-terracotta)"];
const STAT_DARK = new Set(["var(--color-terracotta)", "var(--color-olive-deep)"]);

export function StatCard({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  const bg = accent ?? STAT_ACCENTS[0];
  const dark = STAT_DARK.has(bg);
  return (
    <Card
      className={cn("card-lift min-h-[110px] justify-center gap-0 border-none px-4 py-[18px]", className)}
      // dynamic: warna aksen berasal dari prop/palet runtime
      style={{ background: bg }}
    >
      <p
        className="m-0 mb-2.5 font-meta text-[9px] uppercase tracking-[0.08em]"
        // dynamic: teks kontras dihitung dari warna aksen
        style={{ color: dark ? "var(--color-cream)" : "var(--color-muted)" }}
      >
        {label}
      </p>
      <p
        className="display m-0 text-[32px] leading-[0.9] tracking-[-0.1em]"
        // dynamic: sama seperti label
        style={{ color: dark ? "var(--color-cream)" : "var(--color-ink)" }}
      >
        {value}
      </p>
    </Card>
  );
}

export function SegStat({ stats }: { stats: { label: string; value: React.ReactNode; accent?: string }[] }) {
  return (
    <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-3">
      {stats.map((s, i) => (
        <StatCard
          key={s.label}
          label={s.label}
          value={s.value}
          accent={s.accent ?? STAT_ACCENTS[i % STAT_ACCENTS.length]}
        />
      ))}
    </div>
  );
}
