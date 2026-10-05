"use client";

// Admin: pengumuman CRUD-minimal (buat + daftar) + reveal thread anonim + atur expRules.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function PengumumanAdminPage() {
  const { data, reload } = useFetch<{ rows: { id: string; title: string; target: string }[] }>("/api/announcements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("ALL");
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, target }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Pengumuman terbit");
      setTitle("");
      setBody("");
      reload();
    }
  }

  return (
    <main>
      <h1>Pengumuman</h1>
      <form onSubmit={buat}>
        <label>Judul: <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Isi: <textarea value={body} onChange={(e) => setBody(e.target.value)} required /></label>
        <label>Target:
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="ALL">ALL</option>
            <option value="GURU">GURU</option>
            <option value="SISWA">SISWA</option>
          </select>
        </label>
        <button type="submit">Terbitkan</button>
      </form>
      {msg && <p>{msg}</p>}
      <ul>
        {data?.rows.map((r) => (
          <li key={r.id}>{r.title} ({r.target})</li>
        ))}
      </ul>
    </main>
  );
}
