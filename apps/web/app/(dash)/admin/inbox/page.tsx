"use client";

// Admin: reveal pengirim anonim (tercatat audit) + daftar thread.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function CollabAdminPage() {
  const { data, reload } = useFetch<{ rows: { id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean }[] }>("/api/collab");
  const [msg, setMsg] = useState<string | null>(null);

  async function reveal(id: string) {
    const res = await api(`/api/collab/${id}/reveal`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Pengirim: ${d.sender?.name ?? "?"}`);
      reload();
    }
  }

  return (
    <main>
      <h1>Inbox Kolaborasi (Admin)</h1>
      <p>Reveal hanya untuk anonim dan selalu tercatat di audit log.</p>
      {msg && <p>{msg}</p>}
      <ul>
        {data?.rows.map((t) => (
          <li key={t.id}>
            {t.subject} — {t.sender}
            {t.anonymous && !t.revealed && (
              <button type="button" onClick={() => reveal(t.id)}>Reveal pengirim</button>
            )}
            {t.revealed && " (revealed)"}
          </li>
        ))}
      </ul>
    </main>
  );
}
