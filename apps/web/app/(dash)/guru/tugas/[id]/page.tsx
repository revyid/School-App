"use client";

// Guru: detail tugas + progres + nilai + kirim pengingat/terima kasih (Phase 5 menyambung via notifikasi).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Sub {
  id: string;
  studentId: string;
  text: string | null;
  link: string | null;
  fileName: string | null;
  submittedAt: string;
  isLate: boolean;
  score: number | null;
  feedback: string | null;
  student: { id: string; name: string; nisn: string | null };
}

export default function GuruTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useState(() => {
    void params.then((p) => setId(p.id));
  });
  const detail = useFetch<{
    task: { id: string; title: string; instruction: string; deadline: string | null; allowLate: boolean; class: { name: string } };
    visible: boolean;
    submissions: Sub[];
    pending: { id: string; name: string }[];
  }>(id ? `/api/tasks/${id}` : null);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function nilai(subId: string) {
    const g = grades[subId];
    if (!g?.score) return;
    const res = await api(`/api/submissions/${subId}/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: Number(g.score), feedback: g.feedback || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Nilai tersimpan");
      detail.reload();
    }
  }

  async function ingatkan(kind: "reminder" | "thanks") {
    if (!id) return;
    const res = await api("/api/tasks/nudge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: id, kind }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else setMsg(`Terkirim: ${d.inapp} in-app + ${d.wa} WA`);
  }

  if (!detail.data && detail.loading) return <main><p>Memuat…</p></main>;
  if (detail.error) return <main><p>Gagal: {detail.error}</p></main>;
  if (!detail.data) return <main><p>Memuat…</p></main>;
  const t = detail.data;
  return (
    <main>
      <h1>{t.task.title}</h1>
      <p>Kelas: {t.task.class.name} · {t.visible ? "Terlihat siswa" : "Terjadwal/belum publish"}</p>
      <p>{t.task.instruction}</p>
      <p>Terkumpul: {t.submissions.length} · Belum: {t.pending.length}</p>
      <button type="button" onClick={() => ingatkan("reminder")}>Kirim pengingat ke yang belum mengumpulkan</button>
      <button type="button" onClick={() => ingatkan("thanks")}>Kirim terima kasih ke yang sudah mengumpulkan</button>
      {msg && <p>{msg}</p>}
      <h2>Pengumpulan</h2>
      <table>
        <thead><tr><th>Nama</th><th>Waktu</th><th>Terlambat</th><th>File/Link</th><th>Nilai</th><th>Aksi</th></tr></thead>
        <tbody>
          {t.submissions.map((s) => (
            <tr key={s.id}>
              <td>{s.student.name}</td>
              <td>{new Date(s.submittedAt).toLocaleString("id-ID")}</td>
              <td>{s.isLate ? "Ya" : "Tidak"}</td>
              <td>
                {s.fileName && <a href={`/api/task-files/${t.task.id}/${s.fileName}`}>unduh</a>}
                {s.link && <> <a href={s.link} target="_blank" rel="noreferrer">tautan</a></>}
                {s.text && <span> (teks)</span>}
              </td>
              <td>{s.score ?? "-"}</td>
              <td>
                <input
                  type="number" min={0} max={100} placeholder="0-100" style={{ width: 70 }}
                  value={grades[s.id]?.score ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { score: e.target.value, feedback: grades[s.id]?.feedback ?? "" } })}
                />
                <input
                  placeholder="umpan balik" style={{ width: 140 }}
                  value={grades[s.id]?.feedback ?? ""}
                  onChange={(e) => setGrades({ ...grades, [s.id]: { score: grades[s.id]?.score ?? "", feedback: e.target.value } })}
                />
                <button type="button" onClick={() => nilai(s.id)}>Simpan</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Belum mengumpulkan ({t.pending.length})</h2>
      <ul>
        {t.pending.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </main>
  );
}
