"use client";

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export interface AksiItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// Dropdown aksi baris tabel: satu tombol "Aksi" buka menu popover.
// Ganti deretan tombol ghost yang melebar di kolom Aksi.
export default function RowActions({ items, label = "Aksi" }: { items: AksiItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="btn-sticker btn-ghost"
        style={{ minHeight: 40 }}
        aria-label={`${label} baris`}
      >
        {label} ▾
      </PopoverTrigger>
      <PopoverContent style={{ padding: 6, minWidth: 180 }}>
        <div style={{ display: "grid", gap: 2 }}>
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => { setOpen(false); it.onClick(); }}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                minHeight: 44,
                borderRadius: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: it.danger ? "#b3402a" : "#171716",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#eeeadd"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {it.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Header tabel generik dengan pencarian + filter + tombol utama.
// Dipakai GuruManager dan SiswaManager agar toolbar konsisten.
export function TableToolbar({
  search, onSearch, searchPlaceholder = "Cari…",
  filters, actions,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
        marginBottom: 14,
      }}
    >
      {onSearch && (
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 200px", maxWidth: 300 }}>
          {searchPlaceholder}
          <input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              minHeight: 44, fontSize: 16, padding: "0 12px",
              borderRadius: 12, border: "1px solid rgba(23,23,22,.25)",
              background: "#fffdf8", color: "#171716",
            }}
          />
        </label>
      )}
      {filters}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
        {actions}
      </div>
    </div>
  );
}
