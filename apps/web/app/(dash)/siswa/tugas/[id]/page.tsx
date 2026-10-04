"use client";

// Siswa: detail tugas + materi + kirim (teks/link/file, kirim ulang sebelum deadline).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

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

  if (!detail.data && detail.loading) return <main><p>Memuat…</p></main>;
  if (detail.error) return <main><p>Gagal: {detail.error}</p></main>;
  if (!detail.data) return <main><p>Memuat…</p></main>;
  const t = detail.data;
  const closed = t.state === "TUTUP";
  return (
    <main>
      <h1>{t.task.title}</h1>
      <p>Status: {t.state}{t.task.deadline ? ` · Deadline: ${new Date(t.task.deadline).toLocaleString("id-ID")}` : ""}</p>
      <p>{t.task.instruction}</p>
      <h2>Materi pendukung</h2>
      {mats.data && mats.data.rows.length === 0 && <p>Tidak ada materi.</p>}
      {mats.data && (
        <ul>
          {mats.data.rows.map((m) => (
            <li key={m.id}>
              {m.kind === "TEXT" ? m.text : <a href={`/api/task-files/${t.task.id}/${m.fileName}`}>unduh lampiran ({m.mime})</a>}
            </li>
          ))}
        </ul>
      )}
      {t.submission && (
        <div>
          <h2>Pengumpulan saya</h2>
          <p>Terlambat: {t.submission.isLate ? "Ya" : "Tidak"} · Nilai: {t.submission.score ?? "-"}</p>
          {t.submission.feedback && <p>Umpan balik: {t.submission.feedback}</p>}
          {t.submission.fileName && <p><a href={`/api/task-files/${t.task.id}/${t.submission.fileName}`}>unduh file saya</a></p>}
        </div>
      )}
      {!closed && (
        <form onSubmit={kirim}>
          <h2>{t.submission ? "Kirim ulang" : "Kumpulkan"}</h2>
          <label>Teks/jawaban: <textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
          <label>Tautan: <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></label>
          <label>File (maks 10MB): <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button type="submit">Kirim</button>
        </form>
      )}
      {closed && <p>Batas waktu sudah lewat dan tugas ini tidak menerima keterlambatan.</p>}
      {msg && <p>{msg}</p>}
    </main>
  );
}
