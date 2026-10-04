"use client";

// Lonceng notifikasi in-app (semua role): jumlah belum dibaca + daftar + tandai dibaca.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function Bell() {
  const { data, reload } = useFetch<{
    rows: { id: string; title: string; body: string; readAt: string | null; createdAt: string }[];
    unread: number;
  }>("/api/notifications");
  const [open, setOpen] = useState(false);

  async function readAll() {
    await api("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    reload();
  }

  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} aria-label="Notifikasi">
        🔔{data && data.unread > 0 ? ` (${data.unread})` : ""}
      </button>
      {open && (
        <div>
          <button type="button" onClick={readAll}>Tandai semua dibaca</button>
          <ul>
            {data?.rows.map((n) => (
              <li key={n.id} style={{ fontWeight: n.readAt ? "normal" : "bold" }}>
                {n.title} — {n.body}
              </li>
            )) ?? <li>Memuat…</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
