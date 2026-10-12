"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Base UI tidak punya Label mandiri (hanya Field.Label dalam konteks Field),
// jadi pakai <label> native — sama aksesibelnya lewat htmlFor.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 text-sm font-semibold leading-none text-ink",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
