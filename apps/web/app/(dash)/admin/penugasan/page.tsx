"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, WarmTable, warmCell, Note, Err } from "@/components/DashUI";

export default function AssignmentsPage() {
  const { data, loading, error, reload } = useFetch<{ rows: { id: string; subject: string | null; teacher: { id: string; name: string }; class: { id: string; name: string } }[] }>(`/api/assignments`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");

  async function create() {
    if (!teacherId || !classId) { alert("Pilih guru dan kelas"); return; }
    const res = await api("/api/assignments", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ teacherId, classId, subject: subject.trim() || null }),
    });
    if (!res.ok) { alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status)); return; }
    setTeacherId(""); setClassId(""); setSubject("");
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Hapus penugasan ini?")) return;
    await api(`/api/assignments?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <>
      <PageHead kicker="Data master" title="Penugasan guru-kelas" desc="Tautkan guru ke kelas yang diajarnya, plus mapel bila perlu." />
      <Panel style={{ marginBottom: 16 }}>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada penugasan. Tambahkan di bawah.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Guru", "Kelas", "Mapel", "Aksi"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.teacher.name}</td>
                <td style={warmCell()}>{r.class.name}</td>
                <td style={warmCell()}>{r.subject ?? "-"}</td>
                <td style={warmCell()}><Btn kind="ghost" onClick={() => remove(r.id)}>Hapus</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah penugasan</h2>
        <Toolbar>
          <TextSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Pilih guru</option>
            {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </TextSelect>
          <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas</option>
            {classes?.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </TextSelect>
          <TextInput placeholder="Mapel (opsional)" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ maxWidth: 200 }} />
          <Btn onClick={create}>Tambah</Btn>
        </Toolbar>
      </Panel>
    </>
  );
}
