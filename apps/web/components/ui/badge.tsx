"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-olive/15 text-olive-deep",
        warning: "border-transparent bg-sun/25 text-[#6b5010]",
        danger: "border-transparent bg-destructive/10 text-destructive",
        outline: "border-border text-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

// Status domain → varian (migrasi dari DashUI.Badge).
export function statusVariant(status: string): "success" | "warning" | "danger" | "outline" | "secondary" | "default" {
  switch (status.toUpperCase()) {
    case "HADIR": case "SUDAH": case "AKTIF": case "APPROVED": return "success";
    case "IZIN": return "secondary";
    case "SAKIT": case "TERLAMBAT": case "PENDING": return "warning";
    case "ALPHA": case "REJECTED": return "danger";
    default: return "outline";
  }
}

export { Badge, badgeVariants };
