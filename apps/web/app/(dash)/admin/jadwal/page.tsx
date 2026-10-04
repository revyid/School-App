"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function TimetablePage() {
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const { data: subjects } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/subjects`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const [classId, setClassId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { data, loading, error, reload } = useFetch<{ rows: { id: string; dayOfWeek: number; startTime: string; endTime: string; subjectName: string | null; subjectRef: { name: string } | null; teacher: { name: string } | null }[] }>(
    classId ? `/api/timetable?classId=${classId}&r=${refresh}` : null,
  );
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("07:45");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  async function add() {
    if (!classId) { alert("Pilih kelas"); return; }
    const res = await api("/api/timetable", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, subjectId: subjectId || null, subjectName: "",
        teacherId: teacherId || null, dayOfWeek: Number(day), startTime: start, endTime: end,
      }),
    });
    if (!res.ok) { alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status)); return; }
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Hapus slot ini?")) return;
    await api(`/api/timetable?id=${id}`, { method: "DELETE" });
    setRefresh((r) => r + 1);
    reload();
  }

  return (
    <main>
      <h1>Jadwal Pelajaran</h1>
      <select value={classId} onChange={(e) => setClassId(e.target.value)}>
        <option value="">Pilih kelas</option>
        {classes?.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {loading && <p>Memuat…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {data && (
        <table>
          <thead><tr><th>Hari</th><th>Jam</th><th>Mapel</th><th>Guru</th><th>Aksi</th></tr></thead>
          <tbody>
            {data.rows.map((s) => (
              <tr key={s.id}>
                <td>{DAYS[s.dayOfWeek]}</td>
                <td>{s.startTime}–{s.endTime}</td>
                <td>{s.subjectRef?.name ?? s.subjectName ?? "-"}</td>
                <td>{s.teacher?.name ?? "-"}</td>
                <td><button onClick={() => remove(s.id)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {classId && (
        <>
          <h2>Tambah Slot</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Pilih mapel</option>
              {subjects?.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Pilih guru</option>
              {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button onClick={add}>Tambah</button>
          </div>
        </>
      )}
    </main>
  );
}
