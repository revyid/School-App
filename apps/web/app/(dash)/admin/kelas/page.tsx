"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ClassRow {
  id: string; name: string; gradeLevel: string | null;
  homeroomTeacher: { id: string; name: string } | null;
  _count: { students: number };
}

export default function ClassesPage() {
  const { data, loading, error, reload } = useFetch<{ rows: ClassRow[]; total: number }>(`/api/classes?page=1&perPage=100`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const [name, setName] = useState("");
  const [homeroom, setHomeroom] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function create() {
    if (!name.trim()) return;
    const res = await api("/api/classes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), homeroomTeacherId: homeroom || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setName(""); setHomeroom("");
    reload();
  }

  async function remove(id: string, n: string) {
    setDeleteTarget({ id, name: n });
  }

  async function doRemove() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    const res = await api(`/api/classes/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  return (
    <>
      <PageHead kicker="Data master" title="Kelas" desc="Kelola rombel dan wali kelasnya." />
      <Panel style={{ marginBottom: 16 }}>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada kelas. Tambahkan di bawah.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Nama", "Wali Kelas", "Siswa", "Aksi"]}>
            {data.rows.map((c) => (
              <tr key={c.id}>
                <td style={warmCell({ fontWeight: 700 })}>{c.name}</td>
                <td style={warmCell()}>{c.homeroomTeacher?.name ?? "-"}</td>
                <td style={warmCell()}>{c._count.students}</td>
                <td style={warmCell()}><Btn kind="ghost" onClick={() => remove(c.id, c.name)}>Hapus</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah kelas</h2>
        <Toolbar>
          <TextInput placeholder="Nama kelas (mis. VII-A)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 220 }} />
          <TextSelect value={homeroom} onChange={(e) => setHomeroom(e.target.value)}>
            <option value="">Tanpa wali kelas</option>
            {teachers?.rows.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </TextSelect>
          <Btn onClick={create}>Tambah</Btn>
        </Toolbar>
      </Panel>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Kelas"
        message={deleteTarget ? `Hapus kelas ${deleteTarget.name}?` : ""}
        confirmLabel="Ya, hapus"
        onConfirm={doRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
