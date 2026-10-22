"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Sampul buku + placeholder inisial judul. Gambar rusak tidak pernah tampil.
export default function BookThumb({
  src,
  title,
  className,
}: {
  src?: string | null;
  title: string;
  className?: string;
}) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const initials =
    title
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "B";

  return (
    <div
      className={cn(
        "flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper-deep",
        className,
      )}
    >
      {src && src !== brokenSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setBrokenSrc(src)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-display text-sm font-bold text-muted-strong">{initials}</span>
      )}
    </div>
  );
}
