"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex w-full items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-[13px] leading-[1.6] [&>svg]:mt-px [&>svg]:size-3.5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-line bg-paper-deep/50 text-muted",
        destructive: "border-destructive/30 bg-destructive/10 font-bold text-destructive",
        success: "border-olive/30 bg-olive/10 text-olive-deep",
        warning: "border-sun/40 bg-sun/20 text-sun-deep",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("m-0 font-bold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-description" className={cn("m-0", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
