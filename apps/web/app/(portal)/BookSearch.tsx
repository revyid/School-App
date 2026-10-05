"use client";

// Pencarian katalog e-book (server proxy ke Open Library + cache 10 mnt).
import { useState } from "react";
import { api } from "@/app/lib/api";

export default function BookSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ title: string; authors: string[]; year?: number; infoUrl?: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function cari(e: React.FormEvent) {
    e.preventDefault();
    const res = await api(`/api/books?q=${encodeURIComponent(q)}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setRows(d.rows ?? []);
      setMsg(d.rows?.length === 0 ? "Tidak ketemu" : null);
    }
  }

  return (
    <div>
      <h2>Katalog E-Book</h2>
      <form onSubmit={cari}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="judul / pengarang" />
        <button type="submit">Cari</button>
      </form>
      {msg && <p>{msg}</p>}
      <ul>
        {rows.map((b, i) => (
          <li key={i}>
            <strong>{b.title}</strong> — {b.authors.join(", ")}
            {b.year ? ` (${b.year})` : ""}
            {b.infoUrl && <> <a href={b.infoUrl} target="_blank" rel="noreferrer">info</a></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
