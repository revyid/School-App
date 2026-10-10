"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import {
  PageHead,
  Panel,
  Toolbar,
  TextInput,
  TextSelect,
  Btn,
  Badge,
  WarmTable,
  warmCell,
  Note,
  Err,
  LinkBtn,
} from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";

interface TeacherRow {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  homeroomOf?: { id: string; name: string }[];
  taughtClasses?: {
    id: string;
    subject: string | null;
    class: { id: string; name: string };
  }[];
}

export default function TeachersPage() {
  const { data, loading, error, reload } = useFetch<{
    rows: TeacherRow[];
    total: number;
  }>(`/api/teachers?page=1&perPage=100`);

  const { data: classesData, reload: reloadClasses } = useFetch<{
    rows: { id: string; name: string }[];
  }>("/api/classes?page=1&perPage=100");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [homeroomClassId, setHomeroomClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectClassId, setSubjectClassId] = useState("");
  const [lastPw, setLastPw] = useState<string | null>(null);

  // Modal / form edit penugasan guru
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHomeroom, setEditHomeroom] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newSubjectClassId, setNewSubjectClassId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);

  function askConfirm(title: string, message: string, action: () => Promise<void>) {
    setPending({ title, message, action });
  }

  async function runPending() {
    if (!pending) return;
    const act = pending.action;
    setPending(null);
    await act();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert("Nama dan email guru wajib diisi");
      return;
    }
    const res = await api("/api/teachers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        homeroomClassId: homeroomClassId || null,
        subject: subject.trim() || null,
        subjectClassId: subjectClassId || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Gagal: " + (d.error || res.status));
      return;
    }
    setLastPw(d.tempPassword);
    setName("");
    setEmail("");
    setHomeroomClassId("");
    setSubject("");
    setSubjectClassId("");
    reload();
    reloadClasses();
  }

  function startEdit(t: TeacherRow) {
    setEditingTeacher(t);
    setEditName(t.name);
    setEditEmail(t.email ?? "");
    setEditHomeroom(t.homeroomOf?.[0]?.id ?? "");
    setNewSubject("");
    setNewSubjectClassId("");
  }

  async function saveTeacherEdit() {
    if (!editingTeacher) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/teachers/${editingTeacher.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          homeroomClassId: editHomeroom || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert("Gagal menyimpan guru: " + (d.error || res.status));
        return;
      }
      setEditingTeacher(null);
      reload();
      reloadClasses();
    } finally {
      setSubmitting(false);
    }
  }

  async function addSubjectAssignment() {
    if (!editingTeacher || !newSubject.trim() || !newSubjectClassId) {
      alert("Tentukan nama mapel dan pilih kelas");
      return;
    }
    const res = await api("/api/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teacherId: editingTeacher.id,
        classId: newSubjectClassId,
        subject: newSubject.trim(),
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert("Gagal menambah mapel: " + (d.error || res.status));
      return;
    }
    setNewSubject("");
    setNewSubjectClassId("");
    reload();
  }

  async function removeAssignment(id: string) {
    const aid = id;
    askConfirm("Hapus Penugasan", "Hapus penugasan mapel ini?", async () => {
      await api(`/api/assignments?id=${aid}`, { method: "DELETE" });
      reload();
    });
  }

  async function resetPw(id: string, n: string) {
    askConfirm("Reset Password", `Reset password ${n}?`, async () => {
      const res = await api(`/api/teachers/${id}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Gagal: " + (d.error || res.status));
        return;
      }
      setLastPw(d.tempPassword);
    });
  }

  async function toggle(id: string, active: boolean, n: string) {
    askConfirm(active ? "Nonaktifkan Guru" : "Aktifkan Guru", `${active ? "Nonaktifkan" : "Aktifkan"} ${n}?`, async () => {
      await api(`/api/teachers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      reload();
    });
  }

  const classes = classesData?.rows ?? [];

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Manajemen Guru & Wali Kelas"
        desc="Kelola data akun guru, jabatan wali kelas, serta pengampu mata pelajaran per kelas."
        right={<LinkBtn href="/admin/penugasan">Daftar Semua Penugasan</LinkBtn>}
      />

      {lastPw && (
        <div
          style={{
            background: "#f5c94a",
            color: "#171716",
            padding: "12px 18px",
            borderRadius: 14,
            fontWeight: 700,
            marginBottom: 16,
            border: "2px solid #171716",
          }}
        >
          Password sementara guru baru (simpan sekarang, hanya muncul sekali):{" "}
          <code style={{ background: "#fffdf8", padding: "2px 8px", borderRadius: 6, fontSize: 15 }}>
            {lastPw}
          </code>
        </div>
      )}

      {/* Modal / Panel Edit Guru & Penugasan */}
      {editingTeacher && (
        <Panel style={{ marginBottom: 20, border: "2px solid #e85e43", background: "#fffdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 19, margin: 0 }}>
              Edit Penugasan: <span style={{ color: "#e85e43" }}>{editingTeacher.name}</span>
            </h2>
            <Btn kind="ghost" onClick={() => setEditingTeacher(null)}>Tutup</Btn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nama Guru:
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Email:
              <TextInput value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Wali Kelas:
              <TextSelect value={editHomeroom} onChange={(e) => setEditHomeroom(e.target.value)}>
                <option value="">Bukan Wali Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Btn onClick={saveTeacherEdit} disabled={submitting}>
              {submitting ? "Menyimpan…" : "Simpan Perubahan Identitas & Wali Kelas"}
            </Btn>
          </div>

          {/* Mapel yang diampu guru ini */}
          <div style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Mata Pelajaran yang Diampu Guru Ini:</h3>
            {(!editingTeacher.taughtClasses || editingTeacher.taughtClasses.length === 0) ? (
              <p style={{ color: "#74746d", fontSize: 13 }}>Belum mengampu mata pelajaran di kelas manapun.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {editingTeacher.taughtClasses.map((tc) => (
                  <span
                    key={tc.id}
                    style={{
                      background: "#eeeadd",
                      border: "1px solid rgba(23,23,22,.2)",
                      borderRadius: 99,
                      padding: "4px 12px",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <strong>{tc.subject ?? "Mapel"}</strong> (Kelas {tc.class.name})
                    <button
                      type="button"
                      onClick={() => removeAssignment(tc.id)}
                      style={{ background: "none", border: "none", color: "#e85e43", cursor: "pointer", fontWeight: 800, padding: 0 }}
                      title="Hapus penugasan"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Tambah mapel baru untuk guru ini */}
            <div style={{ background: "#f7f4ec", padding: 12, borderRadius: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>+ Tambah Mapel:</span>
              <TextInput
                placeholder="Nama Mapel (mis. Matematika)"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                style={{ maxWidth: 220 }}
              />
              <TextSelect
                value={newSubjectClassId}
                onChange={(e) => setNewSubjectClassId(e.target.value)}
                style={{ maxWidth: 180 }}
              >
                <option value="">Pilih Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
              <Btn kind="ghost" onClick={addSubjectAssignment}>Tugaskan Mapel</Btn>
            </div>
          </div>
        </Panel>
      )}

      {/* Tabel Data Guru */}
      <Panel style={{ marginBottom: 20 }}>
        {loading && <Note>Memuat data guru…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada data guru. Tambahkan di bawah.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Nama Guru", "Email", "Wali Kelas", "Mapel & Kelas Diampu", "Status", "Aksi"]}>
            {data.rows.map((t) => {
              const homeroomName = t.homeroomOf?.[0]?.name;
              const taught = t.taughtClasses ?? [];

              return (
                <tr key={t.id}>
                  <td style={warmCell({ fontWeight: 700 })}>{t.name}</td>
                  <td style={warmCell()}>{t.email ?? "-"}</td>
                  <td style={warmCell()}>
                    {homeroomName ? (
                      <span
                        style={{
                          background: "#aec6a4",
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontWeight: 700,
                          fontSize: 12,
                          border: "1px solid #171716",
                        }}
                      >
                        Kelas {homeroomName}
                      </span>
                    ) : (
                      <span style={{ color: "#a0a096" }}>-</span>
                    )}
                  </td>
                  <td style={warmCell()}>
                    {taught.length === 0 ? (
                      <span style={{ color: "#a0a096" }}>Belum ada mapel</span>
                    ) : (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 280 }}>
                        {taught.map((tc) => (
                          <span
                            key={tc.id}
                            style={{
                              background: "#eeeadd",
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {tc.subject ?? "Mapel"} ({tc.class.name})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={warmCell()}>
                    <Badge status={t.isActive ? "AKTIF" : "NONAKTIF"}>
                      {t.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td style={warmCell()}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Btn kind="ghost" onClick={() => startEdit(t)}>
                        Atur Penugasan
                      </Btn>
                      <Btn kind="ghost" onClick={() => resetPw(t.id, t.name)}>
                        Reset PW
                      </Btn>
                      <Btn kind="ghost" onClick={() => toggle(t.id, t.isActive, t.name)}>
                        {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </WarmTable>
        )}
      </Panel>

      {/* Form Tambah Guru Baru */}
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 14px" }}>
          Tambah Guru Baru
        </h2>
        <form onSubmit={create} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nama Lengkap Guru *:
              <TextInput
                placeholder="Contoh: Budi Santoso, S.Pd."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Alamat Email *:
              <TextInput
                type="email"
                placeholder="budi@sekolah.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Wali Kelas (Opsional):
              <TextSelect value={homeroomClassId} onChange={(e) => setHomeroomClassId(e.target.value)}>
                <option value="">Bukan Wali Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, borderTop: "1px dashed rgba(23,23,22,.14)", paddingTop: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Mata Pelajaran Utama (Opsional):
              <TextInput
                placeholder="Contoh: Bahasa Indonesia"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Di Kelas:
              <TextSelect value={subjectClassId} onChange={(e) => setSubjectClassId(e.target.value)}>
                <option value="">Pilih Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Btn type="submit" style={{ minHeight: 44, width: "100%" }}>
                + Daftarkan Guru
              </Btn>
            </div>
          </div>
        </form>
      </Panel>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        message={pending?.message ?? ""}
        confirmLabel="Ya, lanjutkan"
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
