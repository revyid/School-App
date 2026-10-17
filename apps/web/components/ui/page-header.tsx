"use client";

import * as React from "react";
import { IconStar } from "@/components/Icons";
import { cn } from "@/lib/utils";

// Header halaman dasbor ala edukids (eyebrow dot + judul display + spark).
export function PageHead({
  kicker,
  title,
  desc,
  right,
  spark,
  className,
}: {
  kicker: string;
  title: string;
  desc?: string;
  right?: React.ReactNode;
  /** Glyph dekoratif melayang di sisi kanan judul */
  spark?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative mb-6 flex flex-wrap items-end justify-between gap-3.5", className)}>
      <div className="relative">
        <p className="kicker mb-2.5">{kicker}</p>
        <h1 className="display m-0 text-[clamp(28px,3.4vw,44px)] tracking-[-0.05em]">
          {title}
          {spark && (
            <span aria-hidden="true" className="anim-drift ml-3 inline-block align-middle text-terracotta opacity-70">
              <IconStar size={Math.round(0.65 * 44)} />
            </span>
          )}
        </h1>
        {desc && <p className="mt-2.5 max-w-[560px] text-[13.5px] leading-[1.7] text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}
