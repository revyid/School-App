"use client";

// T4: detail tugas siswa — Ringkasan · Instruksi & Materi · Kelompok · Kumpulkan (per kategori) · Hasil.
// Mobile-first satu kolom; RichText; contoh file menempel di kartu kategorinya.
import { use, useRef, useState } from "react";
import Link from "next/link";
import { api, useFetch } from "@/app/lib/api";
import RichText from "@/components/RichText";
import GroupSheet from "@/components/GroupSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TASK_TYPE_LABEL, SUBMIT_STATE_LABEL, UPLOAD_ACCEPT_LABEL } from "@sms/shared/lms";
import UploadPopup from "@/components/UploadPopup";
import { ArrowLeftIcon, FileTextIcon, ImageIcon, FileUpIcon, UsersIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";

interface Mat { id: string; kind: string; text?: string; fileName: string | null; mime: string | null; size?: number | null; isMain: boolean; isExample: boolean; categoryId?: string | null }
interface Cat {
  id: string; name: string; instruction: string | null; required: boolean; accept: string[];
  examples: Mat[]; myFile: { fileName: string; mime: string; size: number; originalName: string } | null;
}
interface Detail {
  task: {
    id: string; title: string; type: string; instruction: string; deadline: string | null;
    allowLate: boolean; isGroup: boolean; groupMin: number; groupMax: number;
    class: { name: string }; subject: { name: string } | null; author: { name: string };
  };
  materials: Mat[];
  categories: Cat[];
  mySubmission: { text: string | null; link: string | null; fileName: string | null; submittedAt: string; isLate: boolean; score: number | null; feedback: string | null; files: { categoryId: string | null; fileName: string }[] } | null;
  myGroup: { id: string; name: string; isLeader: boolean; members: { id: string; name: string }[] } | null;
  state: string;
}

function fileUrl(taskId: string, name: string, inline = true) {
  return `/api/task-files/${taskId}/${encodeURIComponent(name)}${inline ? "?inline=1" : ""}`;
}

function fmtSize(n: number) {
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function SiswaTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); // React 19 use(params) — F3
  const detail = useFetch<Detail>(`/api/tasks/${id}`);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [catFiles, setCatFiles] = useState<Record<string, File | null>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const t = detail.data?.task;
  const cats = detail.data?.categories ?? [];
  const hasCategories = cats.length > 0;
  const state = detail.data?.state ?? "BELUM";
  const closed = state === "TUTUP";
  const submitted = state === "SUDAH" || state === "TERLAMBAT";
  const needGroup = !!t?.isGroup && !detail.data?.myGroup;

  const missingRequired = cats.filter((c) => c.required && !catFiles[c.id]).map((c) => c.name);

  async function kirim() {
    setBusy(true); setMsg(null); setProgress(null);
    const form = new FormData();
    const combined = [text.trim(), note.trim() ? `Catatan: ${note.trim()}` : ""].filter(Boolean).join("\n\n");
    if (combined) form.append("text", combined);
    if (link.trim()) form.append("link", link);
    if (!hasCategories && file) form.append("file", file);
    for (const [catId, f] of Object.entries(catFiles)) {
      if (f) form.append(`file_${catId}`, f);
    }
    // XHR untuk event progress unggahan.
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    const done = new Promise<void>((resolve) => { xhr.onloadend = () => resolve(); });
    xhr.open("POST", `/api/tasks/${id}/submit`);
    const token = sessionStorage.getItem("csrf");
    if (token) xhr.setRequestHeader("x-csrf-token", token);
    xhr.send(form);
    await done;
    setBusy(false); setProgress(null); xhrRef.current = null;
    try {
      const d = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) {
        setMsg(d.submission?.isLate ? "Terkirim (terlambat)" : "Terkirim");
        setFile(null); setCatFiles({});
        detail.reload();
      } else {
        setMsg(d.error || `Gagal (${xhr.status})`);
      }
    } catch {
      setMsg("Gagal mengirim.");
    }
  }

  if (detail.loading && !detail.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" /> <Skeleton className="h-24 w-full" /> <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="font-bold text-destructive">Gagal memuat tugas</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail.error}</p>
        <Button className="mt-3" variant="outline" onClick={() => detail.reload()}>Coba lagi</Button>
      </div>
    );
  }
  if (!detail.data || !t) return null;

  const mainMats = (detail.data.materials ?? []).filter((m) => m.isMain || (!m.isExample && !m.categoryId));
  const deadline = t.deadline ? new Date(t.deadline) : null;

  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      {/* 1. Ringkasan */}
      <div>
        <Link href="/siswa/kelasku" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted-strong hover:text-ink">
          <ArrowLeftIcon className="size-4" /> Kembali ke Kelasku
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TASK_TYPE_LABEL[t.type] ?? t.type}</Badge>
          <Badge variant={state === "SUDAH" ? "success" : state === "TERLAMBAT" ? "warning" : state === "TUTUP" ? "danger" : "outline"}>
            {SUBMIT_STATE_LABEL[state] ?? state}
          </Badge>
          {t.subject && <Badge variant="outline">{t.subject.name}</Badge>}
        </div>
        <h1 className="display mt-2 text-2xl">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.class.name} · {t.author.name}
          {deadline && <> · Tenggat: <strong>{deadline.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} WIB</strong></>}
        </p>
      </div>

      {/* 2. Instruksi & Materi */}
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted-strong">Instruksi</h2>
        <RichText text={t.instruction} compact />
        {mainMats.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-line pt-4">
            <h3 className="text-sm font-extrabold">Materi</h3>
            {mainMats.map((m) => (
              <div key={m.id}>
                {m.kind === "TEXT" ? <RichText text={m.text ?? ""} compact /> : (
                  <a href={fileUrl(t.id, m.fileName!)} className="inline-flex items-center gap-2 text-sm font-semibold text-olive-deep hover:underline">
                    {m.mime?.startsWith("video/") ? <FileUpIcon className="size-4" /> : m.mime?.startsWith("image/") ? <ImageIcon className="size-4" /> : <FileTextIcon className="size-4" />}
                    Buka materi ({m.mime?.split("/")[1] ?? "file"})
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Kelompok */}
      {t.isGroup && (
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-strong">Kelompok</h2>
            <Button variant="sticker-ghost" size="sm" onClick={() => setGroupOpen(true)}>
              <UsersIcon className="size-4" /> Atur kelompok
            </Button>
          </div>
          {detail.data.myGroup ? (
            <div className="mt-2">
              <p className="font-extrabold">{detail.data.myGroup.name}</p>
              <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                {detail.data.myGroup.members.map((m) => <li key={m.id}>{m.name}</li>)}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Kamu belum punya kelompok. Bentuk kelompok ({t.groupMin}–{t.groupMax} anggota) sebelum mengumpulkan.</p>
          )}
        </section>
      )}

      {/* 4. Kumpulkan / Kirim ulang (tetap terbuka selama belum TUTUP) */}
      {!closed && (
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-strong">{submitted ? "Kumpulkan ulang" : "Kumpulkan"}</h2>
          {needGroup ? (
            <div className="card border-dashed p-5 text-center">
              <p className="text-sm font-bold">Bentuk kelompok dulu</p>
              <p className="mt-1 text-sm text-muted-foreground">Tugas ini dikumpulkan per kelompok ({t.groupMin}–{t.groupMax} anggota).</p>
              <Button className="mt-3" variant="sticker" onClick={() => setGroupOpen(true)}><UsersIcon className="size-4" /> Atur kelompok</Button>
            </div>
          ) : hasCategories ? (
            cats.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold">{c.name}</p>
                  <Badge variant={c.required ? "danger" : "outline"}>{c.required ? "Wajib" : "Opsional"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Tipe: {c.accept.map((a) => UPLOAD_ACCEPT_LABEL[a] ?? a).join(" / ")}
                  </span>
                </div>
                {c.instruction && <p className="mt-1 text-sm text-muted-foreground">{c.instruction}</p>}
                {c.examples.length > 0 && (
                  <div className="mt-2 rounded-xl bg-paper p-2.5">
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-strong">Contoh</p>
                    {c.examples.map((ex) => (
                      <div key={ex.id}>
                        {ex.kind === "TEXT" ? <RichText text={ex.text ?? ""} compact /> : (
                          <a href={fileUrl(t.id, ex.fileName!)} className="text-sm font-semibold text-olive-deep hover:underline">
                            Lihat contoh ({ex.mime?.split("/")[1] ?? "file"})
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <UploadPopup
                    label={catFiles[c.id] ? catFiles[c.id]!.name : "Klik atau seret file ke sini"}
                    hint={`Maks 1 file (${c.accept.map((a) => UPLOAD_ACCEPT_LABEL[a] ?? a).join("/")})`}
                    maxMb={50}
                    accept={c.accept.map((a) => ({ PDF: ".pdf", IMAGE: "image/*", VIDEO: "video/mp4,video/webm", DOC: ".zip,.docx,.xlsx,.pptx" })[a] ?? "*/*").join(",")}
                    onFile={(f) => setCatFiles((prev) => ({ ...prev, [c.id]: f }))}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="card space-y-3 p-4">
              <p className="font-extrabold">Jawaban</p>
              <div className="grid gap-1.5">
                <Label htmlFor="jawaban-teks">Teks / jawaban</Label>
                <Textarea id="jawaban-teks" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Tulis jawabanmu…" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="jawaban-link">Tautan (opsional)</Label>
                <Input id="jawaban-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" />
              </div>
              <div className="grid gap-1.5">
                <Label>File (opsional, maks 10MB)</Label>
                <UploadPopup label="Pilih file jawaban" maxMb={10} onFile={setFile} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="jawaban-catatan">Catatan untuk guru (opsional)</Label>
                <Input id="jawaban-catatan" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </div>
            </div>
          )}
          {missingRequired.length > 0 && (
            <p className="text-sm font-bold text-destructive">Belum lengkap — kategori wajib belum diisi: {missingRequired.join(", ")}.</p>
          )}
          {progress !== null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full bg-olive-deep transition-all"
                // dynamic: lebar mengikuti progres pengumpulan
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <Button
            variant="sticker"
            disabled={busy || (hasCategories ? missingRequired.length > 0 : (!text.trim() && !link.trim() && !file)) || needGroup}
            onClick={() => void kirim()}
          >
            {busy ? "Mengumpulkan…" : submitted ? "Kumpulkan ulang" : "Kumpulkan"}
          </Button>
        </section>
      )}
      {closed && (
        <div className="card flex items-start gap-2 border-dashed p-4">
          <XCircleIcon className="mt-0.5 size-5 shrink-0 text-muted-strong" />
          <p className="text-sm text-muted-foreground">Batas waktu sudah lewat dan tugas ini tidak menerima keterlambatan.</p>
        </div>
      )}

      {/* 5. Hasil */}
      {detail.data.mySubmission && (
        <section className="card p-5 bg-paper-deep">
          <div className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-olive-deep" />
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-strong">
              Terkumpulkan {detail.data.mySubmission.isLate ? "(terlambat)" : "✓"}
            </h2>
          </div>
          <p className="mt-2 text-sm">
            Dikumpulkan: {new Date(detail.data.mySubmission.submittedAt).toLocaleString("id-ID")} · Nilai:{" "}
            <strong>{detail.data.mySubmission.score ?? "belum dinilai"}</strong>
          </p>
          {detail.data.mySubmission.feedback && (
            <p className="mt-1 text-sm text-muted-foreground">Umpan balik guru: {detail.data.mySubmission.feedback}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {(detail.data.mySubmission.files ?? []).map((f) => (
              <a key={f.fileName} href={fileUrl(t.id, f.fileName)} className="rounded-full border border-line bg-cream px-3 py-1 text-xs font-bold text-ink hover:bg-paper">
                File terkumpulkan
              </a>
            ))}
          </div>
          {!closed && (
            <p className="mt-3 text-xs text-muted-foreground">Kumpulkan ulang masih mungkin sampai batas waktu — formulir di atas tetap terbuka.</p>
          )}
        </section>
      )}

      {msg && <p className="text-sm font-extrabold text-olive-deep">{msg}</p>}

      <GroupSheet taskId={t.id} mode="student" open={groupOpen} onOpenChange={setGroupOpen} onChanged={() => detail.reload()} />
    </div>
  );
}
