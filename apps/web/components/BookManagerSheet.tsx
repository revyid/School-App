"use client";

// Sheet kelola buku sekolah: daftar (thumbnail + aksi) dan form tambah
// (tautan / markdown / unggah file) + sampul. Dipakai halaman publik & admin.
import { useRef, useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "@/app/lib/api";
import BookThumb from "@/components/BookThumb";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export type SchoolBook = {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  source: "LINK" | "UPLOAD" | "MARKDOWN";
  url: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
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
  LINK: "Link",
  UPLOAD: "File",
  MARKDOWN: "Markdown",
};

export default function BookManagerSheet({
  open,
  onOpenChange,
  books,
  loading,
  canManage,
  notice,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: SchoolBook[];
  loading?: boolean;
  /** ADMIN/SUPER_ADMIN: tampilkan form tambah + aksi terbit/hapus. */
  canManage: boolean;
  /** Ditampilkan menggantikan daftar (mis. ajakan masuk untuk tamu). */
  notice?: React.ReactNode;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<Mode>("LINK");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [url, setUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<SchoolBook | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  function reset() {
    setTitle("");
    setAuthor("");
    setUrl("");
    setCoverUrl("");
    setBodyMd("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    if (coverRef.current) coverRef.current.value = "";
  }

  async function uploadCover(f: File | null) {
    if (!f) return;
    setCoverBusy(true);
    const fd = new FormData();
    fd.set("file", f);
    const res = await api("/api/books/thumbnail", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setCoverBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: d.error || `Sampul gagal diunggah (${res.status})` });
      return;
    }
    setCoverUrl(d.coverUrl as string);
    setMsg(null);
  }

  async function tambah(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "UPLOAD") {
        if (!file) {
          setMsg({ ok: false, text: "Pilih file dulu." });
          return;
        }
        const fd = new FormData();
        fd.set("file", file);
        if (title.trim()) fd.set("title", title.trim());
        const res = await api("/api/books/upload", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
          return;
        }
        // Upload tidak menerima author/sampul → lengkapi lewat PATCH.
        const bookId = d.book?.id as string | undefined;
        if (bookId && (coverUrl.trim() || author.trim())) {
          const p = await api(`/api/books/${bookId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ coverUrl: coverUrl.trim() || null, author: author.trim() || null }),
          });
          if (!p.ok) {
            const pd = await p.json().catch(() => ({}));
            setMsg({ ok: false, text: pd.error || "File terunggah, tapi sampul/penulis gagal disimpan." });
            void onChanged();
            return;
          }
        }
        setMsg({ ok: true, text: "File terunggah sebagai draf. Terbitkan bila siap." });
      } else {
        const res = await api("/api/books", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            author: author || null,
            coverUrl: coverUrl.trim() || null,
            ...(mode === "LINK" ? { url } : { bodyMd }),
          }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
          return;
        }
        setMsg({ ok: true, text: "Buku ditambahkan sebagai draf." });
      }
      reset();
      setAdding(false);
      void onChanged();
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
    else {
      setMsg(null);
      void onChanged();
    }
  }

  async function hapus(id: string) {
    const res = await api(`/api/books/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    setToDelete(null);
    if (!res.ok) setMsg({ ok: false, text: d.error || `Gagal (${res.status})` });
    else {
      setMsg({ ok: true, text: "Buku dihapus." });
      void onChanged();
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Buku sekolah</SheetTitle>
            <SheetDescription>Koleksi yang diunggah dan dikurasi oleh sekolah.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            {canManage && (
              <Button type="button" variant="sticker" size="sm" onClick={() => setAdding((v) => !v)}>
                <PlusIcon className="size-4" /> {adding ? "Tutup form" : "Tambah buku"}
              </Button>
            )}

            {canManage && adding && (
              <form className="grid gap-3 rounded-2xl border border-line bg-paper/60 p-4" onSubmit={tambah}>
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

                <div className="grid gap-1">
                  <Label htmlFor="book-title">Judul{mode === "UPLOAD" ? " (opsional, default nama file)" : ""}</Label>
                  <Input id="book-title" value={title} onChange={(e) => setTitle(e.target.value)} required={mode !== "UPLOAD"} maxLength={200} />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="book-author">Penulis</Label>
                  <Input id="book-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={160} />
                </div>

                {mode === "LINK" && (
                  <div className="grid gap-1">
                    <Label htmlFor="book-url">URL sumber (http/https)</Label>
                    <Input id="book-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
                  </div>
                )}
                {mode === "MARKDOWN" && (
                  <div className="grid gap-1">
                    <Label htmlFor="book-md">Isi markdown</Label>
                    <textarea
                      id="book-md"
                      className="rounded-[14px] border border-solid border-line bg-cream pt-[9px] pr-[14px] pb-[9px] pl-[14px] text-sm"
                      value={bodyMd}
                      onChange={(e) => setBodyMd(e.target.value)}
                      required
                      rows={8}
                      placeholder="# Judul bab…"
                    />
                  </div>
                )}
                {mode === "UPLOAD" && (
                  <div className="grid gap-1">
                    <Label htmlFor="book-file">File (pdf, epub, docx, md, txt — maks 25MB)</Label>
                    <input
                      id="book-file"
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.epub,.docx,.md,.txt"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      required
                      className="text-[13px]"
                    />
                  </div>
                )}

                <div className="grid gap-1">
                  <Label htmlFor="book-cover">Sampul (opsional, PNG/JPG/WEBP ≤2MB)</Label>
                  <div className="flex items-center gap-2">
                    <BookThumb src={coverUrl || null} title={title || "Buku"} className="h-14 w-10" />
                    <input
                      id="book-cover"
                      ref={coverRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void uploadCover(e.target.files?.[0] ?? null)}
                      className="text-[12px]"
                    />
                  </div>
                  <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} maxLength={500} placeholder="atau tempel URL sampul" />
                  {coverBusy && <span className="text-[12px] text-muted">Mengunggah sampul…</span>}
                </div>

                <Button variant="sticker" type="submit" disabled={busy || coverBusy}>
                  {busy ? "Menyimpan…" : "Tambah buku"}
                </Button>
              </form>
            )}

            {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.text}</Alert>}

            {notice}

            {!notice && (
              <section className="space-y-2">
                <h3 className="text-sm font-extrabold">Daftar buku ({books.length})</h3>
                {loading && books.length === 0 && <Alert>Memuat…</Alert>}
                {!loading && books.length === 0 && <p className="m-0 text-sm text-muted">Belum ada buku.</p>}
                {books.map((b) => (
                  <article key={b.id} className="flex gap-3 rounded-2xl border border-line bg-cream p-3">
                    <BookThumb src={b.coverUrl} title={b.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{SOURCE_LABEL[b.source]}</Badge>
                        <Badge variant={b.published ? "success" : "warning"}>{b.published ? "Terbit" : "Draf"}</Badge>
                      </div>
                      <a href={`/buku/${b.id}`} className="mt-1 block truncate text-sm font-bold underline-offset-2 hover:underline">
                        {b.title}
                      </a>
                      <div className="truncate text-[11px] text-muted">{b.author || "Tanpa penulis"}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Button type="button" size="sm" variant="outline" render={<a href={`/buku/${b.id}`} />}>
                          Baca
                        </Button>
                        {canManage && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void togglePublish(b)}>
                            {b.published ? "Jadikan draf" : "Terbitkan"}
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Hapus ${b.title}`}
                            onClick={() => setToDelete(b)}
                          >
                            <Trash2Icon className="size-3.5" /> Hapus
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
