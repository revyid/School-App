"use client";

// Admin sekolah: kelola buku sekolah (tautan, markdown, unggah file).
import { useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDialog from "@/components/ConfirmDialog";

type SchoolBook = {
  id: string;
  title: string;
  author: string | null;
  source: "LINK" | "UPLOAD" | "MARKDOWN";
  mimeType: string | null;
  published: boolean;
  createdAt: string;
};

type Mode = "LINK" | "MARKDOWN" | "UPLOAD";

const MODES: { key: Mode; label: string }[] = [
  { key: "LINK", label: "Tautan" },
  { key: "MARKDOWN", label: "Tempel markdown" },
  { key: "UPLOAD", label: "Unggah file" },
];

const SOURCE_LABEL: Record<SchoolBook["source"], string> = {
  LINK: "Tautan",
  UPLOAD: "File",
  MARKDOWN: "Markdown",
};

export default function BukuAdminPage() {
  const { data, reload, loading } = useFetch<{ rows: SchoolBook[] }>("/api/books?scope=school&perPage=100");
  const [mode, setMode] = useState<Mode>("LINK");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<SchoolBook | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setAuthor("");
    setUrl("");
    setCoverUrl("");
    setBodyMd("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let res: Response;
      if (mode === "UPLOAD") {
        if (!file) {
          setMsg({ ok: false, text: "Pilih file dulu." });
          return;
        }
        const fd = new FormData();
        fd.set("file", file);
        if (title.trim()) fd.set("title", title.trim());
        res = await api("/api/books/upload", { method: "POST", body: fd });
      } else {
        res = await api("/api/books", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            mode === "LINK"
              ? { title, author: author || null, url, coverUrl: coverUrl || null }
              : { title, author: author || null, bodyMd },
          ),
        });
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
        return;
      }
      setMsg({ ok: true, text: mode === "UPLOAD" ? "File terunggah sebagai draf. Terbitkan bila siap." : "Buku ditambahkan sebagai draf." });
      reset();
      void reload();
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(b: SchoolBook) {
    const res = await api(`/api/books/${b.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: !b.published }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
    else void reload();
  }

  async function hapus(id: string) {
    const res = await api(`/api/books/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setToDelete(null);
    if (!res.ok) setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
    else {
      setMsg({ ok: true, text: "Buku dihapus." });
      void reload();
    }
  }

  return (
    <>
      <PageHead kicker="Perpustakaan" title="Buku sekolah" desc="Tambahkan buku dari tautan, tempel materi markdown, atau unggah file ebook." />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Jenis buku">
          {MODES.map((m) => (
            <Button
              key={m.key}
              type="button"
              size="sm"
              variant={mode === m.key ? "sticker" : "sticker-ghost"}
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </Button>
          ))}
        </div>

        <form className="grid max-w-[560px] gap-3" onSubmit={tambah}>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Judul{mode === "UPLOAD" ? " (opsional, default nama file)" : ""}:
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required={mode !== "UPLOAD"} maxLength={200} />
          </label>
          {mode !== "UPLOAD" && (
            <label className="grid gap-[6px] text-[13px] text-muted">
              Penulis:
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={160} />
            </label>
          )}

          {mode === "LINK" && (
            <>
              <label className="grid gap-[6px] text-[13px] text-muted">
                URL sumber (http/https):
                <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
              </label>
              <label className="grid gap-[6px] text-[13px] text-muted">
                URL sampul (opsional):
                <Input type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
              </label>
            </>
          )}

          {mode === "MARKDOWN" && (
            <label className="grid gap-[6px] text-[13px] text-muted">
              Isi markdown:
              <textarea
                className="rounded-[14px] border border-solid border-line bg-cream pt-[9px] pr-[14px] pb-[9px] pl-[14px] text-sm"
                value={bodyMd}
                onChange={(e) => setBodyMd(e.target.value)}
                required
                rows={10}
                placeholder="# Judul bab…"
              />
            </label>
          )}

          {mode === "UPLOAD" && (
            <label className="grid gap-[6px] text-[13px] text-muted">
              File (pdf, epub, docx, md, txt — maks 25MB):
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.epub,.docx,.md,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                className="text-[13px]"
              />
            </label>
          )}

          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <Button variant="sticker" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Tambah buku"}</Button>
            <a href="/buku" className="text-[13px] text-muted underline">Lihat rak buku</a>
          </div>
        </form>

        {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.text}</Alert>}
      </Card>

      <Card>
        <h2 className="display m-0 text-[18px]">Daftar buku</h2>
        {loading && !data && <Alert>Memuat…</Alert>}
        {data && data.rows.length === 0 && <Alert>Belum ada buku. Tambahkan yang pertama di atas.</Alert>}
        {data && data.rows.length > 0 && (
          <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="min-w-[640px] text-[13.5px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">Judul</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">Sumber</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">Status</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <a href={`/buku/${b.id}`} className="font-bold underline-offset-2 hover:underline">{b.title}</a>
                      {b.author && <div className="text-[11px] text-muted">{b.author}</div>}
                    </TableCell>
                    <TableCell>{SOURCE_LABEL[b.source]}</TableCell>
                    <TableCell>
                      <Badge variant={b.published ? "success" : "warning"}>{b.published ? "Terbit" : "Draf"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => togglePublish(b)}>
                          {b.published ? "Jadikan draf" : "Terbitkan"}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setToDelete(b)}>
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        title="Hapus buku?"
        message={toDelete ? `"${toDelete.title}" akan dihapus permanen.` : ""}
        confirmLabel="Ya, hapus"
        onConfirm={() => {
          if (toDelete) return hapus(toDelete.id);
        }}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
