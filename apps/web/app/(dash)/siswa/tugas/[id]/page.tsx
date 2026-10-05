"use client";

// Siswa: detail tugas + materi + kirim (teks/link/file, kirim ulang sebelum deadline).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, Note, Err } from "@/components/DashUI";

export default function SiswaTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useState(() => {
    void params.then((p) => setId(p.id));
  });
  const detail = useFetch<{
    task: { id: string; title: string; instruction: string; deadline: string | null; allowLate: boolean; type: string };
    submission: { text: string | null; link: string | null; fileName: string | null; score: number | null; feedback: string | null; isLate: boolean } | null;
    state: string;
  }>(id ? `/api/tasks/${id}` : null);
  const mats = useFetch<{ rows: { id: string; kind: string; text?: string; fileName: string | null; mime: string | null }[] }>(
    id ? `/api/tasks/${id}/materials` : null,
  );
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    let res: Response;
    if (file) {
      const form = new FormData();
      if (text) form.append("text", text);
      if (link) form.append("link", link);
      form.append("file", file);
      res = await api(`/api/tasks/${id}/submit`, { method: "POST", body: form });
    } else {
      res = await api(`/api/tasks/${id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text || null, link: link || null }),
      });
    }
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(d.submission?.isLate ? "Terkirim (terlambat)" : "Terkirim");
      detail.reload();
    }
  }

  if (!detail.data && detail.loading) return <Note>Memuat…</Note>;
  if (detail.error) return <Err>Gagal: {detail.error}</Err>;
  if (!detail.data) return <Note>Memuat…</Note>;
  const t = detail.data;
  const closed = t.state === "TUTUP";
  return (
    <>
      <PageHead
        kicker="Tugas"
        title={t.task.title}
        desc={t.task.deadline ? `Deadline: ${new Date(t.task.deadline).toLocaleString("id-ID")}` : "Tanpa deadline"}
        right={<Badge status={t.state} />}
      />
      <Panel style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{t.task.instruction}</p>
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 10px" }}>Materi pendukung</h2>
        {mats.data && mats.data.rows.length === 0 && <Note>Tidak ada materi.</Note>}
        {mats.data && mats.data.rows.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
            {mats.data.rows.map((m) => (
              <li key={m.id}>
                {m.kind === "TEXT" ? m.text : <a href={`/api/task-files/${t.task.id}/${m.fileName}`}>Unduh lampiran ({m.mime})</a>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {t.submission && (
        <Panel style={{ marginBottom: 16, background: "#eeeadd" }}>
          <h2 className="display" style={{ fontSize: 18, margin: "0 0 10px" }}>Pengumpulan saya</h2>
          <p style={{ margin: "0 0 6px", fontSize: 14 }}>
            Terlambat: {t.submission.isLate ? "Ya" : "Tidak"} · Nilai: <strong>{t.submission.score ?? "-"}</strong>
          </p>
          {t.submission.feedback && <p style={{ margin: 0, fontSize: 14 }}>Umpan balik guru: {t.submission.feedback}</p>}
          {t.submission.fileName && <p style={{ margin: "6px 0 0", fontSize: 14 }}><a href={`/api/task-files/${t.task.id}/${t.submission.fileName}`}>Unduh file saya</a></p>}
        </Panel>
      )}
      {!closed && (
        <Panel>
          <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>{t.submission ? "Kirim ulang" : "Kumpulkan"}</h2>
          <form onSubmit={kirim} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Teks/jawaban:
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Tautan:
              <TextInput value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              File (maks 10MB):
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Toolbar><Btn type="submit">Kirim</Btn></Toolbar>
          </form>
        </Panel>
      )}
      {closed && <Note>Batas waktu sudah lewat dan tugas ini tidak menerima keterlambatan.</Note>}
      {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
    </>
  );
}
