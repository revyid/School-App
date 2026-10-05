"use client";

// Inbox kolaborasi: kirim ke multi-guru + toggle anonim (siswa) + lampiran.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Msg { id: string; authorId: string; body: string; fileName: string | null; createdAt: string }
interface Thread {
  id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean;
  messages: Msg[];
}

export default function CollabPage({ role }: { role: "GURU" | "SISWA" }) {
  const { data, loading, reload } = useFetch<{ rows: Thread[] }>("/api/collab");
  const [subject, setSubject] = useState("");
  const [recipients, setRecipients] = useState("");
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.append("subject", subject);
    form.append("anonymous", String(anon));
    form.append("recipients", JSON.stringify(recipients.split(",").map((s) => s.trim()).filter(Boolean)));
    form.append("body", body);
    if (file) form.append("file", file);
    const res = await api("/api/collab", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Terkirim");
      setSubject("");
      setBody("");
      setFile(null);
      reload();
    }
  }

  async function balas(id: string) {
    const res = await api(`/api/collab/${id}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: replies[id] ?? "" }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setReplies({ ...replies, [id]: "" });
      reload();
    }
  }

  return (
    <main>
      <h1>Inbox Kolaborasi</h1>
      <h2>Kirim baru</h2>
      <form onSubmit={kirim}>
        <label>Subjek: <input value={subject} onChange={(e) => setSubject(e.target.value)} required /></label>
        <label>ID guru tujuan (koma): <input value={recipients} onChange={(e) => setRecipients(e.target.value)} required placeholder="userId guru" /></label>
        <label>Pesan: <textarea value={body} onChange={(e) => setBody(e.target.value)} required /></label>
        {role === "SISWA" && (
          <label><input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Kirim anonim (nama disembunyikan dari guru)</label>
        )}
        <label>Lampiran (opsional): <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button type="submit">Kirim</button>
      </form>
      {msg && <p>{msg}</p>}
      <h2>Thread</h2>
      {loading && <p>Memuat…</p>}
      {data && (
        <ul>
          {data.rows.map((t) => (
            <li key={t.id}>
              <strong>{t.subject}</strong> — dari {t.sender}
              {t.anonymous && !t.revealed && " (anonim)"}
              <ul>
                {t.messages.map((m) => (
                  <li key={m.id}>
                    {m.body}{" "}
                    {m.fileName && <a href={`/api/collab/${t.id}/file?m=${m.id}`} target="_blank" rel="noreferrer">[lampiran]</a>}
                  </li>
                ))}
              </ul>
              <input
                value={replies[t.id] ?? ""}
                onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                placeholder="balas…"
              />
              <button type="button" onClick={() => balas(t.id)}>Balas</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
