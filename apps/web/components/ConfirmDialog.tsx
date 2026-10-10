"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter" && !(document.activeElement instanceof HTMLButtonElement)) {
        e.preventDefault();
        void onConfirm();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(23,23,22,.55)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(100%, 440px)",
          background: "#f7f4ec",
          color: "#171716",
          border: "2px solid #171716",
          borderRadius: 24,
          padding: "24px 28px",
          boxShadow: "0 16px 48px rgba(23,23,22,.25)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3 className="display" style={{ fontSize: 20, margin: 0 }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: "#575752", fontSize: 14, lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
          <button ref={cancelRef} type="button" className="btn-sticker btn-ghost" onClick={onCancel}>
            Batal
          </button>
          <button
            type="button"
            className="btn-sticker"
            style={{ background: "#171716", color: "#fffdf8", borderColor: "#171716" }}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
