"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

// Dialog konfirmasi kustom pengganti confirm() bawaan browser.
// Overlay terpusat, fokus awal ke tombol Batal, Enter = konfirmasi, Esc = batal.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Ya, lanjutkan",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
        if (focusable.length) {
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      } else if (e.key === "Enter" && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault();
        void onConfirm();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previousFocus.current?.focus();
    };
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-ink/55 p-5"
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(100%,440px)] flex-col gap-3.5 rounded-3xl border-2 border-ink bg-paper px-7 py-6 text-ink shadow-[0_16px_48px_rgba(23,23,22,0.25)]"
      >
        <h3 className="display m-0 text-[20px]">
          {title}
        </h3>
        <p className="m-0 text-sm leading-[1.6] text-muted-strong">
          {message}
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <Button ref={cancelRef} type="button" variant="sticker-ghost" onClick={onCancel}>
            Batal
          </Button>
          <Button
            type="button"
            variant="sticker"
            className="border-ink bg-ink text-cream hover:bg-ink/90"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
