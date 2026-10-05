"use client";

// Rapor: tabel agregasi tugas + asesmen per siswa + ekspor .xlsx.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function RaporPage() {
  const [classId, setClassId] = useState("");
  const gb = useFetch<{
    tasks: { id: string; title: string }[];
    assessments: { id: string; title: string }[];
    rows: { studentId: string; name: string; taskScores: Record<string, number | null>; assessScores: Record<string, number | null>; avg: number | null }[];
  }>(classId ? `/api/gradebook?classId=${encodeURIComponent(classId)}` : null);

  return (
    <main>
      <h1>Rapor Kelas</h1>
      <label>ID kelas: <input value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="classId" /></label>
      {classId && (
        <a href={`/api/gradebook/export?classId=${encodeURIComponent(classId)}`} target="_blank" rel="noreferrer">
          Ekspor .xlsx
        </a>
      )}
      {gb.data && (
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              {gb.data.tasks.map((t) => <th key={t.id}>{t.title}</th>)}
              {gb.data.assessments.map((x) => <th key={x.id}>{x.title}</th>)}
              <th>Rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {gb.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.name}</td>
                {gb.data!.tasks.map((t) => <td key={t.id}>{r.taskScores[t.id] ?? "-"}</td>)}
                {gb.data!.assessments.map((x) => <td key={x.id}>{r.assessScores[x.id] ?? "-"}</td>)}
                <td>{r.avg ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
