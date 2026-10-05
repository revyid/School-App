"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, WarmTable, warmCell, Note, Err } from "@/components/DashUI";

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
    <>
      <PageHead kicker="Akademik" title="Jadwal pelajaran" desc="Atur slot mapel per kelas per hari." />
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas</option>
            {classes?.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </TextSelect>
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada slot jadwal untuk kelas ini.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Hari", "Jam", "Mapel", "Guru", "Aksi"]}>
            {data.rows.map((s) => (
              <tr key={s.id}>
                <td style={warmCell({ fontWeight: 700 })}>{DAYS[s.dayOfWeek]}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{s.startTime}–{s.endTime}</td>
                <td style={warmCell()}>{s.subjectRef?.name ?? s.subjectName ?? "-"}</td>
                <td style={warmCell()}>{s.teacher?.name ?? "-"}</td>
                <td style={warmCell()}><Btn kind="ghost" onClick={() => remove(s.id)}>Hapus</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      {classId && (
        <Panel>
          <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah slot</h2>
          <Toolbar>
            <TextSelect value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </TextSelect>
            <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "auto" }} />
            <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "auto" }} />
            <TextSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Pilih mapel</option>
              {subjects?.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </TextSelect>
            <TextSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Pilih guru</option>
              {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </TextSelect>
            <Btn onClick={add}>Tambah</Btn>
          </Toolbar>
        </Panel>
      )}
    </>
  );
}
