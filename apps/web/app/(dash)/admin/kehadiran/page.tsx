"use client";

// Admin: dashboard kehadiran (ringkasan hari ini per kelas) + ekspor bulanan.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Row {
  studentId: string;
  name: string;
  nisn: string | null;
  record: { status: string } | null;
}

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function AdminKehadiranPage() {
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const classes = useFetch<{ rows: { id: string; name: string }[] }>("/api/classes?page=1&perPage=100");
  const [classId, setClassId] = useState("");
  const daily = useFetch<{ rows: Row[]; summary: Record<string, number> }>(
    classId ? `/api/attendance/daily?date=${date}&classId=${classId}` : null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function exportMonthly() {
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await fetch(`/api/attendance/monthly?month=${month}&classId=${classId}`, { cache: "no-store" });
    if (!res.ok) {
      setMsg("Ekspor gagal");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rekap-${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Rekap bulanan terunduh");
  }

  async function cetakMassal() {
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await api(`/api/attendance/daily?date=${date}&classId=${classId}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error || "Gagal");
      return;
    }
    const ids: string[] = d.rows.map((r: Row) => r.studentId);
    const tokens: { name: string; token: string }[] = [];
    for (const id of ids) {
      const r = await fetch(`/api/attendance/qr?studentId=${id}`, { cache: "no-store" });
      const q = await r.json().catch(() => ({}));
      if (r.ok) tokens.push({ name: q.qr.student.name, token: q.qr.token });
    }
    const w = window.open("", "_blank");
    if (!w) {
      setMsg("Popup diblokir browser");
      return;
    }
    w.document.write(`<html><head><title>Kartu QR</title></head><body>${
      tokens.map((t) => `<div style="border:1px solid #000;margin:8px;padding:8px;display:inline-block"><b>${t.name}</b><br/><code>${t.token}</code></div>`).join("")
    }<script>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <main>
      <h1>Kehadiran (Admin)</h1>
      <div>
        <label>Tanggal: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>Kelas:
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— pilih —</option>
            {classes.data?.rows.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      {daily.data && (
        <p>
          Hadir: {daily.data.summary.HADIR} · Izin: {daily.data.summary.IZIN} ·
          Sakit: {daily.data.summary.SAKIT} · Alpha: {daily.data.summary.ALPHA} ·
          Belum: {daily.data.summary.BELUM}
        </p>
      )}
      <div>
        <label>Bulan: <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        <button type="button" onClick={exportMonthly}>Unduh rekap bulanan (.xlsx)</button>
        <button type="button" onClick={cetakMassal}>Cetak kartu QR sekelas</button>
      </div>
      {msg && <p>{msg}</p>}
      {daily.loading && <p>Memuat…</p>}
      {daily.error && <p>Gagal: {daily.error}</p>}
      {daily.data && (
        <table>
          <thead><tr><th>Nama</th><th>NISN</th><th>Status</th></tr></thead>
          <tbody>
            {daily.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.name}</td>
                <td>{r.nisn ?? "-"}</td>
                <td>{r.record ? r.record.status : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
