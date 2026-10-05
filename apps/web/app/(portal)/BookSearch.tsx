"use client";

// Pencarian katalog e-book (server proxy ke Open Library + cache 10 mnt).
import { useState } from "react";
import { api } from "@/app/lib/api";

export default function BookSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ title: string; authors: string[]; year?: number; infoUrl?: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function cari(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setMsg(null);
    const res = await api(`/api/books?q=${encodeURIComponent(q)}`);
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setRows(d.rows ?? []);
      setMsg(d.rows?.length === 0 ? "Tidak ketemu — coba kata kunci lain." : null);
    }
  }

  return (
    <div>
      <form onSubmit={cari} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari judul atau pengarang…"
          aria-label="Cari buku"
          style={{
            flex: 1,
            minWidth: 200,
            borderRadius: 999,
            border: "1px solid #fffdf8",
            background: "#fffdf8",
            padding: "10px 18px",
            fontSize: 14,
            color: "#171716",
          }}
        />
        <button type="submit" disabled={busy} className="btn-sticker" style={{ background: "#f5c94a", color: "#171716", borderColor: "#f5c94a" }}>
          {busy ? "Mencari…" : "Cari"}
        </button>
      </form>
      {msg && <p style={{ fontSize: 13, opacity: 0.9, margin: "10px 0 0" }}>{msg}</p>}
      {rows.length > 0 && (
        <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {rows.slice(0, 6).map((b, i) => (
            <li
              key={i}
              style={{
                background: "rgba(255,253,248,.12)",
                border: "1px solid rgba(255,253,248,.35)",
                borderRadius: 14,
                padding: "10px 14px",
                fontSize: 13.5,
              }}
            >
              <strong>{b.title}</strong> — {b.authors.join(", ")}
              {b.year ? ` (${b.year})` : ""}
              {b.infoUrl && (
                <> · <a href={b.infoUrl} target="_blank" rel="noreferrer" style={{ color: "#f5c94a", fontWeight: 700 }}>info ↗</a></>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
