"use client";

// Siswa: daftar tugas + filter Sudah/Belum/Terlambat.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";

interface TaskRow {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  subjectName: string | null;
  materials: number;
  state: string;
  score: number | null;
}

export default function SiswaTugasPage() {
  const [status, setStatus] = useState("semua");
  const { data, loading, error } = useFetch<{ rows: TaskRow[] }>(`/api/tasks?status=${status}`);

  return (
    <main>
      <h1>Tugas Saya</h1>
      <label>Filter:
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="semua">Semua</option>
          <option value="belum">Belum dikumpulkan</option>
          <option value="sudah">Sudah dikumpulkan</option>
          <option value="terlambat">Terlambat/tutup</option>
        </select>
      </label>
      {loading && <p>Memuat…</p>}
      {error && <p>Gagal: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Judul</th><th>Mapel</th><th>Deadline</th><th>Status</th><th>Nilai</th></tr></thead>
          <tbody>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td><a href={`/siswa/tugas/${t.id}`}>{t.title}</a></td>
                <td>{t.subjectName ?? "-"}</td>
                <td>{t.deadline ? new Date(t.deadline).toLocaleString("id-ID") : "-"}</td>
                <td>{t.state}</td>
                <td>{t.score ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.rows.length === 0 && <p>Tidak ada tugas pada filter ini.</p>}
    </main>
  );
}
