"use client";

// Inbox kolaborasi: kirim ke multi-guru via dropdown multiselect + toggle anonim + lampiran.
import { useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Note } from "@/components/DashUI";
import { Badge, statusVariant } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UploadPopup from "@/components/UploadPopup";
import { ChevronDownIcon, XIcon, CheckIcon } from "lucide-react";

interface Msg { id: string; authorId: string | null; body: string; fileName: string | null; fileMime?: string | null; createdAt: string }
interface Thread {
  id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean;
  messages: Msg[];
}
interface GuruRow { id: string; name: string; email: string }

/* ── Dropdown multiselect guru ─────────────────────────── */
function GuruDropdown({ gurus, selected, onChange, loading }: {
  gurus: GuruRow[]; selected: string[]; onChange: (ids: string[]) => void; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onBlur = (e: React.FocusEvent) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false); };
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const labels = gurus.filter((g) => selected.includes(g.id));

  return (
    <div ref={ref} className="relative" onBlur={onBlur}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-line bg-cream px-3 py-2.5 text-left text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {loading && <span className="text-muted-strong">Memuat…</span>}
          {!loading && labels.length === 0 && <span className="text-muted-strong">— pilih guru tujuan —</span>}
          {labels.map((g) => (
            <span key={g.id} className="flex items-center gap-1 rounded-xl bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">
              {g.name}
              <button type="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); toggle(g.id); }} aria-label={`Hapus ${g.name}`} className="flex items-center">
                <XIcon size={10} />
              </button>
            </span>
          ))}
        </span>
        <ChevronDownIcon size={14} className="shrink-0 text-muted-strong" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-2xl border border-line bg-cream shadow-xl">
          {gurus.length === 0 && <p className="px-4 py-3 text-[13px] text-muted-strong">Belum ada guru.</p>}
          {gurus.map((g) => {
            const checked = selected.includes(g.id);
            return (
              <button key={g.id} type="button" onClick={() => toggle(g.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-paper">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-md border-2" style={checked ? { background: "#171716", borderColor: "#171716" } : { borderColor: "rgba(23,23,22,.3)" }}>
                  {checked && <CheckIcon size={10} color="#fff" strokeWidth={3} />}
                </span>
                <span className="flex-1 font-medium">{g.name}</span>
                <span className="text-[11px] text-muted-strong">{g.email}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Halaman utama ─────────────────────────────────────── */
export default function CollabPage({ role }: { role: "GURU" | "SISWA" }) {
  const { data, loading, reload } = useFetch<{ rows: Thread[] }>("/api/collab");
  const gurus = useFetch<{ rows: GuruRow[] }>("/api/teachers?perPage=100");
  const [subject, setSubject] = useState("");
  const [selectedGurus, setSelectedGurus] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (selectedGurus.length === 0) { setMsg("Pilih minimal 1 guru tujuan"); return; }
    const form = new FormData();
    form.append("subject", subject);
    form.append("anonymous", String(anon));
    form.append("recipients", JSON.stringify(selectedGurus));
    form.append("body", body);
    if (file) form.append("file", file);
    const res = await api("/api/collab", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else { setMsg("Terkirim ✓"); setSubject(""); setSelectedGurus([]); setBody(""); setFile(null); setNewOpen(false); reload(); }
  }

  async function balas(id: string) {
    const res = await api(`/api/collab/${id}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: replies[id] ?? "" }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else { setReplies({ ...replies, [id]: "" }); reload(); }
  }

  return (
    <>
      <PageHead kicker="Komunikasi" title="Inbox kolaborasi" desc="Kirim pesan ke guru dan lanjutkan percakapan dalam thread." />
      <Toolbar><Button variant="sticker" onClick={() => setNewOpen(true)}>+ Pesan baru</Button></Toolbar>
      {msg && <p className="mb-3 text-[13px] font-bold" style={{ color: msg.startsWith("Terkirim") ? "#50643e" : "#c94b35" }}>{msg}</p>}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pesan baru</DialogTitle>
            <DialogDescription>Kirim pesan ke guru dan lanjutkan percakapan dalam thread.</DialogDescription>
          </DialogHeader>
        <form onSubmit={kirim} className="grid gap-3.5">
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-strong">
            Guru tujuan
            <GuruDropdown gurus={gurus.data?.rows ?? []} selected={selectedGurus} onChange={setSelectedGurus} loading={gurus.loading} />
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-strong">
            Subjek
            <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} placeholder="Topik percakapan…" />
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-strong">
            Pesan
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={4}
              maxLength={10000}
              placeholder="Tulis pesan di sini…"
              className="rounded-2xl border border-line bg-cream px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink/30"
            />
          </label>
          {role === "SISWA" && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} className="size-4" />
              Kirim anonim (nama disembunyikan dari guru)
            </label>
          )}
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-wide text-muted-strong">
            Lampiran (opsional)
          </label>
          <UploadPopup label="Lampirkan file" onFile={setFile} />
          <Toolbar><Button variant="sticker" type="submit">Kirim</Button></Toolbar>
        </form>
        </DialogContent>
      </Dialog>

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
                  {t.anonymous && !t.revealed && <Badge variant={statusVariant("PENDING")}>anonim</Badge>}
                </p>
                <ul style={{ margin: "8px 0", paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>
                  {t.messages.map((m) => (
                    <li key={m.id}>
                      {m.body}{" "}
                      {m.fileName && (
                        <span style={{ display: "grid", gap: 6, marginTop: 8, maxWidth: "100%" }}>
                          <a href={`/api/collab/${t.id}/file?m=${m.id}`} target="_blank" rel="noreferrer">Buka/unduh {m.fileName}</a>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <Button variant="sticker-ghost" type="button" onClick={() => balas(t.id)}>Balas</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
