"use client";

// Admin: kalender akademik (hari libur / hari efektif per bulan).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface CalRow {
  id: string;
  date: string;
  kind: string;
  note: string | null;
  class: { id: string; name: string } | null;
}

function thisMonth(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function KalenderPage() {
  const [month, setMonth] = useState(thisMonth());
  const { data, loading, error, reload } = useFetch<{ rows: CalRow[] }>(`/api/attendance/calendar?month=${month}`);
  const classes = useFetch<{ rows: { id: string; name: string }[] }>("/api/classes?page=1&perPage=100");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("LIBUR");
  const [classId, setClassId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/attendance/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, kind, classId: classId || null, note: note || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Tersimpan");
      setDate("");
      setNote("");
      reload();
    }
  }

  async function hapus(id: string) {
    if (!confirm("Hapus hari khusus ini?")) return;
    const res = await api(`/api/attendance/calendar?id=${id}`, { method: "DELETE" });
    if (!res.ok) setMsg("Gagal menghapus");
    else reload();
  }

  return (
    <main>
      <h1>Kalender Akademik</h1>
      <label>Bulan: <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
      {loading && <p>Memuat…</p>}
      {error && <p>Gagal: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Tanggal</th><th>Jenis</th><th>Kelas</th><th>Catatan</th><th></th></tr></thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td>{r.date.slice(0, 10)}</td>
                <td>{r.kind}</td>
                <td>{r.class?.name ?? "Semua"}</td>
                <td>{r.note ?? "-"}</td>
                <td><button type="button" onClick={() => hapus(r.id)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2>Tambah / ubah hari</h2>
      <form onSubmit={save}>
        <label>Tanggal: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Jenis:
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="LIBUR">LIBUR</option>
            <option value="EFEKTIF">EFEKTIF (masuk walau tanpa jadwal)</option>
          </select>
        </label>
        <label>Kelas (kosongkan = semua sekolah):
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Semua</option>
            {classes.data?.rows.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label>Catatan: <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} /></label>
        <button type="submit">Simpan</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
