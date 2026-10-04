"use client";

// Guru: daftar tugas + buat tugas + progres pengumpulan.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface TaskRow {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  allowLate: boolean;
  visible: boolean;
  class: { name: string };
  subject: { name: string } | null;
  _count: { submissions: number; materials: number };
}

export default function GuruTugasPage() {
  const classes = useFetch<{ rows: { id: string; class: { name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const tasks = useFetch<{ rows: TaskRow[] }>(`/api/tasks${classId ? `?classId=${classId}` : ""}`);
  const [form, setForm] = useState({ title: "", instruction: "", deadline: "", allowLate: false });
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await api("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId,
        title: form.title,
        instruction: form.instruction,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        allowLate: form.allowLate,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Tugas dibuat");
      setForm({ title: "", instruction: "", deadline: "", allowLate: false });
      tasks.reload();
    }
  }

  return (
    <main>
      <h1>Tugas (Guru)</h1>
      <label>Kelas:
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Semua kelas saya</option>
          {classes.data?.rows.map((r) => (
            <option key={r.id} value={r.id}>{r.class.name}</option>
          ))}
        </select>
      </label>
      {tasks.loading && <p>Memuat…</p>}
      {tasks.error && <p>Gagal: {tasks.error}</p>}
      {tasks.data && (
        <table>
          <thead><tr><th>Judul</th><th>Kelas</th><th>Deadline</th><th>Terlihat</th><th>Terkumpul</th></tr></thead>
          <tbody>
            {tasks.data.rows.map((t) => (
              <tr key={t.id}>
                <td><a href={`/guru/tugas/${t.id}`}>{t.title}</a></td>
                <td>{t.class.name}</td>
                <td>{t.deadline ? new Date(t.deadline).toLocaleString("id-ID") : "-"}</td>
                <td>{t.visible ? "Ya" : "Terjadwal"}</td>
                <td>{t._count.submissions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Buat tugas baru</h2>
      <form onSubmit={buat}>
        <label>Judul: <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} /></label>
        <label>Instruksi: <textarea value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} required /></label>
        <label>Deadline: <input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.allowLate} onChange={(e) => setForm({ ...form, allowLate: e.target.checked })} /> Boleh terlambat</label>
        <button type="submit">Buat</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
