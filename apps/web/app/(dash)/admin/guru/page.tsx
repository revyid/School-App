"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function TeachersPage() {
  const { data, loading, error, reload } = useFetch<{ rows: { id: string; name: string; email: string | null; nisn: string | null; isActive: boolean }[]; total: number }>(`/api/teachers?page=1&perPage=100`);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastPw, setLastPw] = useState<string | null>(null);

  async function create() {
    const res = await api("/api/teachers", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setLastPw(d.tempPassword);
    setName(""); setEmail("");
    reload();
  }

  async function resetPw(id: string, n: string) {
    if (!confirm(`Reset password ${n}?`)) return;
    const res = await api(`/api/teachers/${id}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setLastPw(d.tempPassword);
  }

  async function toggle(id: string, active: boolean, n: string) {
    if (!confirm(`${active ? "Nonaktifkan" : "Aktifkan"} ${n}?`)) return;
    await api(`/api/teachers/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !active }),
    });
    reload();
  }

  return (
    <main>
      <h1>Guru</h1>
      {lastPw && <p style={{ background: "#ffe", padding: 8 }}>Password sementara (tampilkan sekali): <b>{lastPw}</b></p>}
      {loading && <p>Memuat…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>NISN</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.email ?? "-"}</td>
                <td>{t.nisn ?? "-"}</td>
                <td>{t.isActive ? "Aktif" : "Nonaktif"}</td>
                <td style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => resetPw(t.id, t.name)}>Reset PW</button>
                  <button onClick={() => toggle(t.id, t.isActive, t.name)}>{t.isActive ? "Nonaktif" : "Aktif"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Tambah Guru</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button onClick={create}>Tambah</button>
      </div>
      <p><a href="/admin/penugasan">→ Penugasan guru-kelas</a></p>
    </main>
  );
}
