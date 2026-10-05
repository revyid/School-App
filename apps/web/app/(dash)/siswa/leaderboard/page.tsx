"use client";

// Leaderboard EXP per kelas (semua role; guru/siswa dibatasi kelasnya server-side).
import { useState } from "react";
import { api } from "@/app/lib/api";

export default function LeaderboardPage() {
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<{ studentId: string; name: string; points: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function lihat(e: React.FormEvent) {
    e.preventDefault();
    const res = await api(`/api/exp/leaderboard?classId=${encodeURIComponent(classId)}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else setRows(d.rows ?? []);
  }

  return (
    <main>
      <h1>Leaderboard EXP</h1>
      <form onSubmit={lihat}>
        <label>ID kelas: <input value={classId} onChange={(e) => setClassId(e.target.value)} required /></label>
        <button type="submit">Lihat</button>
      </form>
      {msg && <p>{msg}</p>}
      <ol>
        {rows.map((r) => (
          <li key={r.studentId}>{r.name} — {r.points} XP</li>
        ))}
      </ol>
    </main>
  );
}
