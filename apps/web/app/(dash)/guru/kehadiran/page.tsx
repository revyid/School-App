"use client";

// Rekap kehadiran harian per kelas (guru: hanya kelasnya — server menolak yang lain).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Row {
  studentId: string;
  name: string;
  nisn: string | null;
  record: { status: string; source: string; scannedAt: string | null; note: string | null } | null;
}

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function KehadiranPage() {
  const [date, setDate] = useState(todayStr());
  const classes = useFetch<{ rows: { id: string; class: { name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const daily = useFetch<{ rows: Row[]; summary: Record<string, number> }>(
    classId ? `/api/attendance/daily?date=${date}&classId=${classId}` : null,
  );
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function saveManual(studentId: string) {
    const status = edit[studentId];
    if (!status) return;
    const res = await api("/api/attendance/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, date, status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Tersimpan: ${status}`);
      daily.reload();
    }
  }

  return (
    <main>
      <h1>Kehadiran Harian</h1>
      <div>
        <label>Tanggal: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Kelas:
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— pilih —</option>
            {classes.data?.rows.map((r) => (
              <option key={r.id} value={r.id}>{r.class.name}</option>
            ))}
          </select>
        </label>
      </div>
      {daily.data && (
        <p>
          Hadir: {daily.data.summary.HADIR} · Izin: {daily.data.summary.IZIN} ·
          Sakit: {daily.data.summary.SAKIT} · Alpha: {daily.data.summary.ALPHA} ·
          Belum tercatat: {daily.data.summary.BELUM}
        </p>
      )}
      {msg && <p>{msg}</p>}
      {daily.loading && <p>Memuat…</p>}
      {daily.error && <p>Gagal: {daily.error}</p>}
      {daily.data && (
        <table>
          <thead><tr><th>Nama</th><th>NISN</th><th>Status</th><th>Ubah manual</th></tr></thead>
          <tbody>
            {daily.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.name}</td>
                <td>{r.nisn ?? "-"}</td>
                <td>{r.record ? `${r.record.status} (${r.record.source})` : "—"}</td>
                <td>
                  <select value={edit[r.studentId] ?? ""} onChange={(e) => setEdit({ ...edit, [r.studentId]: e.target.value })}>
                    <option value="">—</option>
                    <option value="HADIR">HADIR</option>
                    <option value="IZIN">IZIN</option>
                    <option value="SAKIT">SAKIT</option>
                    <option value="ALPHA">ALPHA</option>
                  </select>
                  <button type="button" onClick={() => saveManual(r.studentId)}>Simpan</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p><a href="/guru/scanner">Ke scanner</a></p>
    </main>
  );
}
