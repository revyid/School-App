"use client";

// Select Base UI — dropdown pilihan. API:
// <Select value onValueChange><SelectTrigger><SelectValue placeholder/>
// </SelectTrigger><SelectPositioner><SelectPopup><SelectItem value=…>
import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Select({ ...props }: SelectPrimitive.Root.Props<string>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-input bg-cream px-3 py-2 text-sm text-ink outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[popup-open]:border-ring",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDownIcon className="size-4 shrink-0 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, children, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("min-w-0 flex-1 truncate text-left data-[placeholder]:text-muted-foreground", className)}
      {...props}
    >
      {children ?? (props.placeholder as React.ReactNode) ?? null}
    </SelectPrimitive.Value>
  );
}

function SelectPositioner({ className, ...props }: SelectPrimitive.Positioner.Props) {
  return (
    <SelectPrimitive.Positioner
      data-slot="select-positioner"
      className={cn("z-50 outline-none", className)}
      sideOffset={6}
      {...props}
    />
  );
}

function SelectPopup({ className, children, ...props }: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Popup
      data-slot="select-popup"
      className={cn(
        "max-h-[min(24rem,var(--available-height))] min-w-[var(--trigger-width)] overflow-y-auto rounded-2xl border border-line bg-cream p-1.5 shadow-xl duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Popup>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink outline-none transition-colors select-none data-[highlighted]:bg-paper data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.ItemIndicator className="ml-auto shrink-0">
        <CheckIcon className="size-4 text-olive-deep" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectGroup({ ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-3 pt-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-strong", className)}
      {...props}
    />
  );
}

export { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem, SelectGroup, SelectLabel };
