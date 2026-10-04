"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface ClassRow {
  id: string; name: string; gradeLevel: string | null;
  homeroomTeacher: { id: string; name: string } | null;
  _count: { students: number };
}

export default function ClassesPage() {
  const { data, loading, error, reload } = useFetch<{ rows: ClassRow[]; total: number }>(`/api/classes?page=1&perPage=100`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const [name, setName] = useState("");
  const [homeroom, setHomeroom] = useState("");

  async function create() {
    if (!name.trim()) return;
    const res = await api("/api/classes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), homeroomTeacherId: homeroom || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setName(""); setHomeroom("");
    reload();
  }

  async function remove(id: string, n: string) {
    if (!confirm(`Hapus kelas ${n}?`)) return;
    const res = await api(`/api/classes/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  return (
    <main>
      <h1>Kelas</h1>
      {loading && <p>Memuat…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Nama</th><th>Wali Kelas</th><th>Siswa</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.homeroomTeacher?.name ?? "-"}</td>
                <td>{c._count.students}</td>
                <td><button onClick={() => remove(c.id, c.name)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Tambah Kelas</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="Nama kelas (mis. VII-A)" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={homeroom} onChange={(e) => setHomeroom(e.target.value)}>
          <option value="">Tanpa wali kelas</option>
          {teachers?.rows.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button onClick={create}>Tambah</button>
      </div>
    </main>
  );
}
