"use client";

// Inbox kolaborasi: kirim ke multi-guru + toggle anonim (siswa) + lampiran.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, Note } from "@/components/DashUI";

interface Msg { id: string; authorId: string; body: string; fileName: string | null; fileMime?: string | null; createdAt: string }
interface Thread {
  id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean;
  messages: Msg[];
}

export default function CollabPage({ role }: { role: "GURU" | "SISWA" }) {
  const { data, loading, reload } = useFetch<{ rows: Thread[] }>("/api/collab");
  const gurus = useFetch<{ rows: { id: string; name: string; email: string }[] }>("/api/teachers?perPage=100");
  const [subject, setSubject] = useState("");
  const [selectedGurus, setSelectedGurus] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (selectedGurus.length === 0) {
      setMsg("Pilih minimal 1 guru tujuan");
      return;
    }
    const form = new FormData();
    form.append("subject", subject);
    form.append("anonymous", String(anon));
    form.append("recipients", JSON.stringify(selectedGurus));
    form.append("body", body);
    if (file) form.append("file", file);
    const res = await api("/api/collab", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Terkirim");
      setSubject("");
      setSelectedGurus([]);
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
    <>
      <PageHead kicker="Komunikasi" title="Inbox kolaborasi" desc="Kirim pesan ke guru dan lanjutkan percakapan dalam thread." />
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Kirim baru</h2>
        <form onSubmit={kirim} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Subjek:
            <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>
          <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            <span>Guru tujuan (centang minimal 1):</span>
            {gurus.loading && <span style={{ fontSize: 12 }}>Memuat daftar guru…</span>}
            {(gurus.data?.rows ?? []).map((g) => (
              <label key={g.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#171716" }}>
                <input
                  type="checkbox"
                  checked={selectedGurus.includes(g.id)}
                  onChange={(e) => setSelectedGurus(
                    e.target.checked
                      ? [...selectedGurus, g.id]
                      : selectedGurus.filter((x) => x !== g.id),
                  )}
                />
                {g.name}
              </label>
            ))}
            {gurus.data && gurus.data.rows.length === 0 && <span style={{ fontSize: 12 }}>Belum ada guru.</span>}
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Pesan:
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          {role === "SISWA" && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Kirim anonim (nama disembunyikan dari guru)
            </label>
          )}
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Lampiran (opsional):
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Toolbar><Btn type="submit">Kirim</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Thread</h2>
        {loading && <Note>Memuat…</Note>}
        {data && data.rows.length === 0 && <Note>Belum ada percakapan.</Note>}
        {data && data.rows.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {data.rows.map((t) => (
              <li key={t.id} style={{ padding: 14, border: "1px solid rgba(23,23,22,.14)", borderRadius: 16 }}>
                <p style={{ margin: "0 0 4px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{t.subject}</strong>
                  <span style={{ fontSize: 12.5, color: "#74746d" }}>dari {t.sender}</span>
                  {t.anonymous && !t.revealed && <Badge status="PENDING">anonim</Badge>}
                </p>
                <ul style={{ margin: "8px 0", paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>
                  {t.messages.map((m) => (
                    <li key={m.id}>
                      {m.body}{" "}
                      {m.fileName && (
                        <span style={{ display: "grid", gap: 6, marginTop: 8, maxWidth: "100%" }}>
                          <a href={`/api/collab/${t.id}/file?m=${m.id}`} target="_blank" rel="noreferrer">Buka/unduh {m.fileName}</a>
                          {m.fileMime?.startsWith("image/") && <img src={`/api/collab/${t.id}/file?m=${m.id}`} alt={`Lampiran ${m.fileName}`} style={{ maxWidth: "100%", width: "min(420px, 100%)", maxHeight: 360, objectFit: "contain", borderRadius: 10, border: "1px solid rgba(23,23,22,.14)" }} />}
                          {m.fileMime === "application/pdf" && <iframe title={`Preview ${m.fileName}`} src={`/api/collab/${t.id}/file?m=${m.id}`} style={{ width: "100%", minHeight: 280, border: "1px solid rgba(23,23,22,.14)", borderRadius: 10 }} />}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <span style={{ display: "flex", gap: 6 }}>
                  <TextInput
                    value={replies[t.id] ?? ""}
                    onChange={(e) => setReplies({ ...replies, [t.id]: e.target.value })}
                    placeholder="balas…"
                    style={{ flex: 1 }}
                  />
                  <Btn kind="ghost" type="button" onClick={() => balas(t.id)}>Balas</Btn>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
