"use client";

// Guru: persetujuan izin siswa kelasnya (APPROVED mengecualikan auto-alpha).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Row {
  id: string;
  date: string;
  kind: string;
  description: string;
  status: string;
  hasPhoto: boolean;
  student: { id: string; name: string };
}

export default function IzinGuruPage() {
  const [status, setStatus] = useState("PENDING");
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>(`/api/leave?status=${status}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    const res = await api(`/api/leave/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: notes[id] || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`${decision === "APPROVED" ? "Disetujui" : "Ditolak"}`);
      reload();
    }
  }

  return (
    <main>
      <h1>Persetujuan Izin</h1>
      <label>Status:
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
      </label>
      {loading && <p>Memuat…</p>}
      {error && <p>Gagal: {error}</p>}
      {msg && <p>{msg}</p>}
      {data && (
        <table>
          <thead><tr><th>Tanggal</th><th>Nama</th><th>Jenis</th><th>Alasan</th><th>Foto</th><th>Catatan</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date.slice(0, 10)}</td>
                <td>{r.student.name}</td>
                <td>{r.kind}</td>
                <td>{r.description}</td>
                <td>
                  {r.hasPhoto ? (
                    <>
                      <a href={`/api/leave/${r.id}/photo?which=siswa`} target="_blank" rel="noreferrer">siswa</a>{" "}
                      <a href={`/api/leave/${r.id}/photo?which=ortu`} target="_blank" rel="noreferrer">ortu</a>
                    </>
                  ) : "-"}
                </td>
                <td>
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    placeholder="catatan (opsional)"
                  />
                </td>
                <td>
                  {r.status === "PENDING" ? (
                    <>
                      <button type="button" onClick={() => review(r.id, "APPROVED")}>Setujui</button>
                      <button type="button" onClick={() => review(r.id, "REJECTED")}>Tolak</button>
                    </>
                  ) : r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
