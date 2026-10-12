"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Varian "sticker" = gaya khas aplikasi (border tebal + bayangan keras),
// dipindah dari duplikasi per halaman ke satu tempat di sini (F2).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold outline-none transition-all select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[3px_3px_0_#171716] hover:bg-terracotta-dark",
        sticker: "border border-ink bg-terracotta text-cream shadow-[3px_3px_0_#171716] hover:bg-terracotta-dark",
        "sticker-ghost": "border border-ink bg-cream text-ink shadow-[3px_3px_0_rgba(23,23,22,0.18)] hover:bg-paper-deep",
        secondary: "bg-secondary text-secondary-foreground hover:bg-paper-deep",
        outline: "border border-input bg-cream text-ink hover:bg-accent",
        ghost: "bg-transparent text-ink hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-xs": "size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
