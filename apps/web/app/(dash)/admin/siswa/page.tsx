"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err, LinkBtn } from "@/components/DashUI";

interface StudentRow {
  userId: string;
  classId: string | null;
  parentPhone: string | null;
  gender: string | null;
  user: { id: string; name: string; nisn: string | null; email: string | null; isActive: boolean };
  class: { id: string; name: string } | null;
}

export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams({ page: String(page), perPage: "20", q: debounced, ...(classId ? { classId } : {}) });
  const { data, loading, error, reload } = useFetch<{ rows: StudentRow[]; total: number; page: number; perPage: number }>(
    `/api/students?${qs}`,
  );
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editPhone, setEditPhone] = useState("");

  function startEdit(row: StudentRow) {
    setEditing(row);
    setEditName(row.user.name);
    setEditClass(row.classId ?? "");
    setEditPhone(row.parentPhone ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await api(`/api/students/${editing.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        classId: editClass || null,
        parentPhone: editPhone.trim() || null,
      }),
    });
    if (!res.ok) {
      alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
      return;
    }
    setEditing(null);
    reload();
  }

  async function toggleActive(row: StudentRow) {
    if (!confirm(`${row.user.isActive ? "Nonaktifkan" : "Aktifkan"} ${row.user.name}?`)) return;
    const res = await api(`/api/students/${row.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.user.isActive }),
    });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Daftar siswa"
        desc={`Total ${data?.total ?? "…"} siswa. Cari, saring per kelas, edit, atau nonaktifkan.`}
        right={<span style={{ display: "flex", gap: 8 }}><LinkBtn href="/admin/import">Import Excel</LinkBtn><LinkBtn kind="dark" href="/api/students/import/template">Unduh template .xlsx</LinkBtn></span>}
      />
      <Panel>
        <Toolbar>
          <TextInput placeholder="Cari nama / NISN" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
          <TextSelect value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
            <option value="">Semua kelas</option>
            {classes?.rows.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </TextSelect>
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Tidak ada siswa yang cocok.</Note>}
        {data && data.rows.length > 0 && (
          <>
            <WarmTable head={["Nama", "NISN", "Kelas", "No Ortu", "Status", "Aksi"]}>
              {data.rows.map((r) => (
                <tr key={r.userId}>
                  <td style={warmCell({ fontWeight: 700 })}>{r.user.name}</td>
                  <td style={warmCell()}>{r.user.nisn ?? "-"}</td>
                  <td style={warmCell()}>{r.class?.name ?? "-"}</td>
                  <td style={warmCell()}>{r.parentPhone ?? "-"}</td>
                  <td style={warmCell()}><Badge status={r.user.isActive ? "AKTIF" : "NONAKTIF"}>{r.user.isActive ? "Aktif" : "Nonaktif"}</Badge></td>
                  <td style={warmCell()}>
                    <span style={{ display: "flex", gap: 6 }}>
                      <Btn kind="ghost" onClick={() => startEdit(r)}>Edit</Btn>
                      <Btn kind="ghost" onClick={() => toggleActive(r)}>{r.user.isActive ? "Nonaktifkan" : "Aktifkan"}</Btn>
                    </span>
                  </td>
                </tr>
              ))}
            </WarmTable>
            <Toolbar>
              <Btn kind="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Sebelumnya</Btn>
              <span style={{ fontSize: 13, color: "#74746d" }}>Halaman {page}/{totalPages}</span>
              <Btn kind="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya ›</Btn>
            </Toolbar>
          </>
        )}
      </Panel>
      {editing && (
        <div role="dialog" aria-label="Edit siswa" style={{ position: "fixed", inset: 0, background: "rgba(23,23,22,.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div style={{ background: "#fffdf8", borderRadius: 20, padding: 22, minWidth: 300, display: "grid", gap: 12 }}>
            <h2 className="display" style={{ margin: 0, fontSize: 20 }}>Edit siswa</h2>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Nama <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Kelas
              <TextSelect value={editClass} onChange={(e) => setEditClass(e.target.value)}>
                <option value="">Tanpa kelas</option>
                {classes?.rows.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </TextSelect>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>No ortu <TextInput value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="628…" /></label>
            <Toolbar>
              <Btn onClick={saveEdit}>Simpan</Btn>
              <Btn kind="ghost" onClick={() => setEditing(null)}>Batal</Btn>
            </Toolbar>
          </div>
        </div>
      )}
    </>
  );
}
