"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverPositioner({ className, ...props }: PopoverPrimitive.Positioner.Props) {
  return (
    <PopoverPrimitive.Positioner
      data-slot="popover-positioner"
      className={cn("z-50 outline-none", className)}
      sideOffset={6}
      {...props}
    />
  );
}

function PopoverContent({ className, children, ...props }: PopoverPrimitive.Popup.Props) {
  return (
    <PopoverPositioner>
      <PopoverPrimitive.Popup
        data-slot="popover-content"
        className={cn(
          "max-w-[min(92vw,24rem)] rounded-2xl border border-line bg-cream p-4 shadow-xl outline-none duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
      </PopoverPrimitive.Popup>
    </PopoverPositioner>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
