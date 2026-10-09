"use client";

// Guru: daftar tugas + buat tugas + progres pengumpulan.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, WarmTable, warmCell, Badge, Note, Err } from "@/components/DashUI";

interface TaskRow {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  allowLate: boolean;
  visible: boolean;
  class: { name: string };
  subject: { name: string } | null;
  _count: { submissions: number; materials: number };
}

export default function GuruTugasPage() {
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  // Satu guru bisa punya >1 penugasan di kelas yang sama (beda mapel) — tampilkan sekali saja.
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const tasks = useFetch<{ rows: TaskRow[] }>(`/api/tasks${classId ? `?classId=${classId}` : ""}`);
  const [form, setForm] = useState({ title: "", instruction: "", deadline: "", allowLate: false });
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await api("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId,
        title: form.title,
        instruction: form.instruction,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        allowLate: form.allowLate,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Tugas dibuat");
      setForm({ title: "", instruction: "", deadline: "", allowLate: false });
      tasks.reload();
    }
  }

  return (
    <>
      <PageHead kicker="Belajar" title="Tugas kelas" desc="Buat tugas dan pantau siapa saja yang sudah mengumpulkan." />
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Kelas:
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Semua kelas saya</option>
              {kelasUnik.map((r) => (
                <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
              ))}
            </TextSelect>
          </label>
        </Toolbar>
        {tasks.loading && <Note>Memuat…</Note>}
        {tasks.error && <Err>Gagal: {tasks.error}</Err>}
        {tasks.data && tasks.data.rows.length === 0 && <Note>Belum ada tugas di kelas ini. Buat yang pertama di bawah.</Note>}
        {tasks.data && tasks.data.rows.length > 0 && (
          <WarmTable head={["Judul", "Kelas", "Deadline", "Terlihat", "Terkumpul"]}>
            {tasks.data.rows.map((t) => (
              <tr key={t.id}>
                <td style={warmCell()}><a href={`/guru/tugas/${t.id}`} style={{ fontWeight: 700, color: "#171716" }}>{t.title}</a></td>
                <td style={warmCell()}>{t.class.name}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{t.deadline ? new Date(t.deadline).toLocaleString("id-ID") : "-"}</td>
                <td style={warmCell()}><Badge status={t.visible ? "AKTIF" : "PENDING"}>{t.visible ? "Ya" : "Terjadwal"}</Badge></td>
                <td style={warmCell()}>{t._count.submissions}</td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Buat tugas baru</h2>
        <form onSubmit={buat} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Judul:
            <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Instruksi:
            <textarea value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} required rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Deadline:
            <TextInput type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={{ width: "auto" }} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={form.allowLate} onChange={(e) => setForm({ ...form, allowLate: e.target.checked })} /> Boleh terlambat
          </label>
          <Toolbar><Btn type="submit">Buat tugas</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
    </>
  );
}
