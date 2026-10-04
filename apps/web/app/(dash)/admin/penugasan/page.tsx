"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function AssignmentsPage() {
  const { data, loading, error, reload } = useFetch<{ rows: { id: string; subject: string | null; teacher: { id: string; name: string }; class: { id: string; name: string } }[] }>(`/api/assignments`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");

  async function create() {
    if (!teacherId || !classId) { alert("Pilih guru dan kelas"); return; }
    const res = await api("/api/assignments", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ teacherId, classId, subject: subject.trim() || null }),
    });
    if (!res.ok) { alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status)); return; }
    setTeacherId(""); setClassId(""); setSubject("");
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Hapus penugasan ini?")) return;
    await api(`/api/assignments?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <main>
      <h1>Penugasan Guru-Kelas</h1>
      {loading && <p>Memuat…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Guru</th><th>Kelas</th><th>Mapel</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.teacher.name}</td>
                <td>{r.class.name}</td>
                <td>{r.subject ?? "-"}</td>
                <td><button onClick={() => remove(r.id)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Tambah Penugasan</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          <option value="">Pilih guru</option>
          {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Pilih kelas</option>
          {classes?.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Mapel (opsional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <button onClick={create}>Tambah</button>
      </div>
    </main>
  );
}
