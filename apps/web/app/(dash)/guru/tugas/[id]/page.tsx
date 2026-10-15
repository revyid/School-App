"use client";

// T5: detail tugas guru — Tabs: Ringkasan · Daftar siswa · Kelompok · Pengaturan.
// Roster SATU tabel: status, file per kategori (klik buka), nilai inline (Enter simpan),
// pengingat per siswa & massal (dialog pratinjau + hasil per siswa), chart donut + histogram.
import { use, useRef, useState } from "react";
import Link from "next/link";
import { api, useFetch } from "@/app/lib/api";
import RichText from "@/components/RichText";
import ConfirmDialog from "@/components/ConfirmDialog";
import GroupSheet from "@/components/GroupSheet";
import CategorySheet from "@/components/CategorySheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTab, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { TASK_TYPE_LABEL, SUBMIT_STATE_LABEL } from "@sms/shared/lms";
import { ArrowLeftIcon, BellIcon, FileTextIcon, UsersIcon, Trash2Icon, PlusIcon } from "lucide-react";

interface Detail {
  task: {
    id: string; title: string; type: string; instruction: string; deadline: string | null; publishAt: string;
    allowLate: boolean; isGroup: boolean; groupMin: number; groupMax: number; status: string;
    class: { id: string; name: string };
    targets?: { id: string; classId: string; class: { id: string; name: string }; deadline: string | null }[];
    subject: { id: string; name: string } | null;
    materials: { id: string; kind: string; text: string | null; fileName: string | null; mime: string | null; isMain: boolean; isExample: boolean; categoryId: string | null }[];
    categories: { id: string; name: string; instruction: string | null; required: boolean; accept: string[]; examples: unknown[] }[];
  };
  visible: boolean;
  stats: { submitted: number; late: number; avgScore: number; totalStudents: number };
}

interface RosterRow {
  student: { id: string; name: string };
  submissionId: string | null;
  group: { id: string; name: string } | null;
  state: string;
  submittedAt: string | null;
  isLate: boolean | null;
  files: { categoryId: string | null; name: string; mime: string; size: number }[];
  hasText: boolean; hasLink: boolean;
  score: number | null;
  feedback: string | null;
  parent: { hasPhone: boolean };
}

const STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "secondary" | "outline"> = {
  SUDAH: "success", TERLAMBAT: "warning", BELUM: "outline", TUTUP: "danger",
};

export default function GuruTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useFetch<Detail>(`/api/tasks/${id}`);
  const [statusF, setStatusF] = useState("");
  const [q, setQ] = useState("");
  const roster = useFetch<{ rows: RosterRow[]; stats: { total: number; done: number; late: number; missing: number; avg: number | null } }>(
    `/api/tasks/${id}/roster${statusF ? `?status=${statusF}` : ""}${statusF && q ? "&" : ""}${q ? `${statusF ? "" : "?"}q=${encodeURIComponent(q)}` : ""}`,
  );
  const [groupOpen, setGroupOpen] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<RosterRow | "massal" | null>(null);
  const [nudgeInapp, setNudgeInapp] = useState(true);
  const [nudgeWa, setNudgeWa] = useState(false);
  const [nudgeResult, setNudgeResult] = useState<{ summary?: { total: number; waQueued: number; noPhone: string[] } } | null>(null);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [confirmHapus, setConfirmHapus] = useState(false);
  const [confirmHapusKelas, setConfirmHapusKelas] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    title?: string; instruction?: string; deadline?: string; allowLate?: boolean;
    subjectId?: string | null; type?: string; publishAt?: string;
    isGroup?: boolean; groupMin?: number; groupMax?: number;
  }>({});
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const subjects = useFetch<{ rows: { id: string; name: string }[] }>("/api/subjects");
  const tClsId = detail.data?.task.class.id ?? "";
  // Mapel kelas tugas ini dari jadwal (auto-mapping); fallback global.
  const mapelKelas = useFetch<{ subjects: { id: string | null; name: string }[] }>(
    tClsId ? `/api/timetable/subjects?classId=${tClsId}` : null,
  );
  const mapelOpts = (mapelKelas.data && mapelKelas.data.subjects.length > 0)
    ? mapelKelas.data.subjects.filter((s) => s.id).map((s) => ({ id: s.id as string, name: s.name }))
    : (subjects.data?.rows ?? []);
  const [savedScore, setSavedScore] = useState<Record<string, string>>({});
  const waReady = useFetch<{ connected: boolean }>(`/api/wa/ready`);
  const myClasses = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (myClasses.data?.rows ?? []).filter((r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i);
  const [selectedAddClass, setSelectedAddClass] = useState("");
  const [addClassBusy, setAddClassBusy] = useState(false);

  const t = detail.data?.task;
  const cats = t?.categories ?? [];
  const rows = roster.data?.rows ?? [];
  const stats = roster.data?.stats;

  async function saveScore(r: RosterRow) {
    if (!r.submissionId) return;
    const val = savedScore[r.student.id];
    const score = val === undefined || val === "" ? null : Math.max(0, Math.min(100, Number(val)));
    if (score === null) return;
    const res = await api(`/api/tasks/${id}/grades`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grades: [{ submissionId: r.submissionId, score, applyToMembers: true }] }),
    });
    if (res.ok) {
      setSavedScore((p) => ({ ...p, [r.student.id]: String(score) }));
      roster.reload();
    }
  }

  async function kirimNudge() {
    if (!nudgeTarget) return;
    setNudgeBusy(true);
    const res = await api(`/api/tasks/${id}/nudge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(nudgeTarget === "massal" ? {} : { studentIds: [nudgeTarget.student.id] }),
        stage: "reminder",
        inapp: nudgeInapp,
        wa: nudgeWa,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setNudgeBusy(false);
    if (!res.ok) { setNudgeResult({ summary: undefined }); return; }
    setNudgeResult(d);
    roster.reload();
  }

  async function simpanPengaturan() {
    if (!t) return;
    const body: Record<string, unknown> = {
      title: edit.title ?? t.title,
      instruction: edit.instruction ?? t.instruction,
      deadline: edit.deadline !== undefined ? (edit.deadline ? new Date(edit.deadline).toISOString() : null) : (t.deadline ? new Date(t.deadline).toISOString() : null),
      allowLate: edit.allowLate !== undefined ? edit.allowLate : t.allowLate,
    };
    if (edit.subjectId !== undefined) body.subjectId = edit.subjectId;
    if (edit.type !== undefined) body.type = edit.type;
    if (edit.publishAt !== undefined) body.publishAt = edit.publishAt ? new Date(edit.publishAt).toISOString() : null;
    if (edit.isGroup !== undefined) body.isGroup = edit.isGroup;
    if (edit.groupMin !== undefined) body.groupMin = edit.groupMin;
    if (edit.groupMax !== undefined) body.groupMax = edit.groupMax;
    const res = await api(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setEditMsg(d.error || "Gagal menyimpan");
    else { setEditMsg("Tersimpan"); detail.reload(); }
  }

  async function tambahKategori(c: { name: string; instruction: string; required: boolean; accept: string[] }) {
    if (!t) return;
    setCatBusy(true);
    const res = await api(`/api/tasks/${t.id}/categories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: c.name, instruction: c.instruction || undefined, accept: c.accept, required: c.required }),
    });
    setCatBusy(false);
    if (res.ok) detail.reload();
  }

  async function hapusKategori(catId: string) {
    if (!t) return;
    await api(`/api/tasks/${t.id}/categories/${catId}`, { method: "DELETE" });
    detail.reload();
  }

  async function terbitkan(publish: boolean) {
    if (!t) return;
    const res = await api(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: publish ? "PUBLISHED" : "DRAFT" }),
    });
    if (res.ok) detail.reload();
  }

  async function hapusTugas() {
    if (!t) return;
    const res = await api(`/api/tasks/${t.id}`, { method: "DELETE" });
    if (res.ok) window.location.href = "/guru/tugas";
  }

  if (detail.loading && !detail.data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (detail.error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
        <p className="font-bold text-destructive">Gagal memuat</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail.error}</p>
        <Button variant="outline" className="mt-3" onClick={() => detail.reload()}>Coba lagi</Button>
      </div>
    );
  }
  if (!t) return null;

  const deadline = t.deadline ? new Date(t.deadline) : null;
  const hoursLeft = deadline ? (deadline.getTime() - Date.now()) / 3600000 : null;
  const missingCount = stats?.missing ?? 0;

  // Chart data: donut status + histogram nilai (5 rentang).
  const donut = [
    { label: "Sudah", n: stats?.done ?? 0, color: "#71845a" },
    { label: "Terlambat", n: stats?.late ?? 0, color: "#f5c94a" },
    { label: "Belum", n: stats?.missing ?? 0, color: "#e85e43" },
  ];
  const total = donut.reduce((s, d) => s + d.n, 0) || 1;
  const buckets = [0, 0, 0, 0, 0];
  for (const r of rows) if (r.score != null) buckets[Math.min(4, Math.floor(r.score / 20))]++;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/guru/tugas" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-strong hover:text-ink">
          <ArrowLeftIcon className="size-4" /> Kembali
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TASK_TYPE_LABEL[t.type] ?? t.type}</Badge>
          <Badge variant={t.status === "PUBLISHED" ? "success" : "warning"}>{t.status === "PUBLISHED" ? "Terbit" : "Draf"}</Badge>
          {!detail.data?.visible && <Badge variant="outline">Terjadwal</Badge>}
        </div>
        <h1 className="display mt-2 text-2xl">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          {t.class.name}{t.subject ? ` · ${t.subject.name}` : ""}
          {deadline ? ` · Tenggat: ${deadline.toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} WIB` : " · Tanpa tenggat"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="sticker" size="sm" onClick={() => void simpanPengaturan()}>Simpan</Button>
          {t.status === "DRAFT" ? (
            <Button variant="sticker" size="sm" onClick={() => void terbitkan(true)}>Terbitkan</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void terbitkan(false)}>Batalkan terbit</Button>
          )}
          <details className="relative">
            <summary className="cursor-pointer rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-bold hover:bg-paper-deep">Lainnya</summary>
            <div className="card absolute z-20 mt-1 flex min-w-44 flex-col p-1.5">
              <button type="button" className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-paper" onClick={() => { setNudgeTarget("massal"); setNudgeResult(null); }}>Ingatkan / Nudge</button>
              {t.isGroup && (
                <button type="button" className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-paper" onClick={() => setGroupOpen(true)}>Kelola kelompok</button>
              )}
              <button type="button" className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-paper" onClick={() => window.print()}>Cetak</button>
              <button type="button" className="rounded-md px-3 py-2 text-left text-sm font-bold text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmHapus(true)}>Hapus</button>
            </div>
          </details>
        </div>
      </div>

      {/* Banner kontekstual pengingat (muncul bila deadline <24 jam atau terlewat) */}
      {(hoursLeft !== null && hoursLeft < 24 || missingCount > 0) && (hoursLeft === null || hoursLeft < 24) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 p-4" style={{ borderLeftColor: "var(--color-terracotta)" }}>
          <p className="text-sm font-medium">
            {missingCount} siswa belum mengumpulkan
            {hoursLeft !== null && hoursLeft > 0 ? ` · deadline ${Math.round(hoursLeft)} jam lagi` : " · deadline sudah lewat"}
          </p>
          <Button variant="sticker" size="sm" onClick={() => { setNudgeTarget("massal"); setNudgeResult(null); }}>
            <BellIcon className="size-4" /> Kirim pengingat WA ke orang tua
          </Button>
        </div>
      )}

      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTab value="ringkasan">Ringkasan</TabsTab>
          <TabsTab value="siswa">Daftar siswa</TabsTab>
          {t.isGroup && <TabsTab value="kelompok">Kelompok</TabsTab>}
          <TabsTab value="pengaturan">Pengaturan</TabsTab>
        </TabsList>

        {/* ---- Ringkasan ---- */}
        <TabsContent value="ringkasan">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card p-5 sm:col-span-2">
              <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-strong">Instruksi</h2>
              <RichText text={t.instruction} compact />
              {cats.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-muted-strong">Kategori unggahan</h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {cats.map((c) => (
                      <li key={c.id}><strong>{c.name}</strong> {c.required ? "(wajib)" : "(opsional)"} — {c.accept.join(", ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:col-span-2">
              {[
                { label: "Terkumpul", n: stats?.done ?? 0 }, { label: "Terlambat", n: stats?.late ?? 0 },
                { label: "Belum", n: missingCount }, { label: "Rata-rata", n: stats?.avg ?? "-" },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className="display text-2xl">{s.n}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-strong">{s.label}</p>
                </div>
              ))}
            </div>
            {/* Chart donut status */}
            <div className="card p-5">
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-strong">Status pengumpulan</h3>
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 42 42" className="size-28 -rotate-90" role="img" aria-label="Diagram status pengumpulan">
                  {(() => { let acc = 0; return donut.map((d) => {
                    const frac = d.n / total;
                    const el = (
                      <circle key={d.label} cx="21" cy="21" r="15.9" fill="none" stroke={d.color} strokeWidth="7"
                        strokeDasharray={`${frac * 100} ${100 - frac * 100}`} strokeDashoffset={-acc * 100} pathLength={100} />
                    );
                    acc += frac; return el;
                  }); })()}
                </svg>
                <ul className="space-y-1.5 text-sm">
                  {donut.map((d) => (
                    <li key={d.label} className="flex items-center gap-2">
                      <span className="inline-block size-3 rounded-full" style={{ background: d.color }} /> {d.label}: <strong>{d.n}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* Histogram nilai */}
            <div className="card p-5">
              <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-strong">Distribusi nilai</h3>
              <div className="flex h-28 items-end gap-2">
                {buckets.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-bold">{n || ""}</span>
                    <div className="w-full rounded-t-lg bg-olive" style={{ height: `${Math.max(3, (n / Math.max(1, ...buckets)) * 100)}%` }} />
                    <span className="text-[10px] text-muted-strong">{i * 20}–{i * 20 + 19}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ---- Daftar siswa (roster) ---- */}
        <TabsContent value="siswa">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <Input placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-44" inputMode="search" />
              {["", "sudah", "belum", "terlambat"].map((s) => (
                <button key={s} type="button" onClick={() => setStatusF(s)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${statusF === s ? "bg-ink text-cream" : "bg-paper text-muted-strong hover:bg-paper-deep"}`}>
                  {s === "" ? "Semua" : SUBMIT_STATE_LABEL[s === "sudah" ? "SUDAH" : s === "belum" ? "BELUM" : "TERLAMBAT"]}
                </button>
              ))}
            </div>
            {/* Tabel → kartu bertumpuk ≤640px (U4) */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-strong">
                    <th className="px-3 py-2.5">Nama</th>
                    {t.isGroup && <th className="px-3 py-2.5">Kelompok</th>}
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Waktu</th>
                    <th className="px-3 py-2.5">File</th>
                    <th className="px-3 py-2.5">Nilai</th>
                    <th className="px-3 py-2.5">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student.id} className="border-b border-line/60 align-middle">
                      <td className="px-3 py-2.5 font-semibold">{r.student.name}</td>
                      {t.isGroup && <td className="px-3 py-2.5 text-muted-foreground">{r.group?.name ?? "—"}</td>}
                      <td className="px-3 py-2.5"><Badge variant={STATUS_BADGE[r.state] ?? "outline"}>{SUBMIT_STATE_LABEL[r.state] ?? r.state}</Badge></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {r.files.map((f) => (
                            <a key={f.name} href={`/api/task-files/${t.id}/${encodeURIComponent(f.name)}`} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold hover:bg-paper" title={f.name}>
                              {cats.find((c) => c.id === f.categoryId)?.name ?? "file"}
                            </a>
                          ))}
                          {r.hasText && <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold">teks</span>}
                          {r.files.length + (r.hasText ? 1 : 0) === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          className="h-8 w-16"
                          inputMode="numeric"
                          defaultValue={r.score ?? ""}
                          placeholder="0-100"
                          onChange={(e) => setSavedScore((p) => ({ ...p, [r.student.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") void saveScore(r); }}
                          aria-label={`Nilai ${r.student.name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        {(r.state === "BELUM" || r.state === "TUTUP") && (
                          <Button variant="ghost" size="icon-sm" onClick={() => { setNudgeTarget(r); setNudgeResult(null); }} aria-label={`Ingatkan ${r.student.name}`}>
                            <BellIcon className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Versi kartu mobile */}
            <div className="divide-y divide-line sm:hidden">
              {rows.map((r) => (
                <div key={r.student.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{r.student.name}</p>
                    <Badge variant={STATUS_BADGE[r.state] ?? "outline"}>{SUBMIT_STATE_LABEL[r.state] ?? r.state}</Badge>
                  </div>
                  {t.isGroup && r.group && <p className="text-xs text-muted-foreground">Kelompok: {r.group.name}</p>}
                  <p className="text-xs text-muted-foreground">{r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID") : "Belum mengumpulkan"}</p>
                  <div className="flex flex-wrap gap-1">
                    {r.files.map((f) => (
                      <a key={f.name} href={`/api/task-files/${t.id}/${encodeURIComponent(f.name)}`} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold">
                        {cats.find((c) => c.id === f.categoryId)?.name ?? "file"}
                      </a>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input className="h-8 w-20" inputMode="numeric" defaultValue={r.score ?? ""} placeholder="Nilai"
                      onChange={(e) => setSavedScore((p) => ({ ...p, [r.student.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveScore(r); }} aria-label={`Nilai ${r.student.name}`} />
                    {(r.state === "BELUM" || r.state === "TUTUP") && (
                      <Button variant="ghost" size="sm" onClick={() => { setNudgeTarget(r); setNudgeResult(null); }}>
                        <BellIcon className="size-4" /> Ingatkan
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {roster.loading && !roster.data && <div className="p-4"><Skeleton className="h-40 w-full" /></div>}
            {roster.data && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada siswa pada filter ini.</p>}
          </div>
        </TabsContent>

        {/* ---- Kelompok ---- */}
        {t.isGroup && (
          <TabsContent value="kelompok">
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-extrabold">Kelompok</h2>
                  <p className="text-sm text-muted-foreground">Aturan {t.groupMin}–{t.groupMax} anggota. Guru bisa mengubah kapan pun.</p>
                </div>
                <Button variant="sticker-ghost" onClick={() => setGroupOpen(true)}><UsersIcon className="size-4" /> Kelola kelompok</Button>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ---- Pengaturan ---- */}
        <TabsContent value="pengaturan">
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Kartu kiri: edit semua field tugas */}
            <div className="card space-y-3 p-5">
              <h2 className="font-extrabold">Edit tugas</h2>

              {/* FASE 3: Kelola target kelas (multi-kelas) */}
              <div className="space-y-2 rounded-xl border border-line bg-paper/40 p-3">
                <span className="block text-[12px] font-bold text-muted-strong uppercase tracking-wide">
                  Kelas yang ditugaskan
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-bold text-ink">
                    {t.class.name} <span className="text-[10px] text-muted-strong">(utama)</span>
                  </span>
                  {t.targets?.filter((tg) => tg.classId !== t.class.id).map((tg) => (
                    <span key={tg.classId} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-bold text-ink">
                      {tg.class.name}
                      <button
                        type="button"
                        onClick={() => setConfirmHapusKelas(tg.classId)}
                        className="text-terracotta hover:opacity-70"
                        title="Hapus dari kelas ini"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                {kelasUnik.filter((k) => k.class.id !== t.class.id && !t.targets?.some((tg) => tg.classId === k.class.id)).length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={selectedAddClass}
                      onChange={(e) => setSelectedAddClass(e.target.value)}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    >
                      <option value="">— Tambah ke kelas lain —</option>
                      {kelasUnik
                        .filter((k) => k.class.id !== t.class.id && !t.targets?.some((tg) => tg.classId === k.class.id))
                        .map((k) => (
                          <option key={k.class.id} value={k.class.id}>{k.class.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedAddClass || addClassBusy}
                      onClick={async () => {
                        if (!selectedAddClass) return;
                        setAddClassBusy(true);
                        await api(`/api/tasks/${t.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ target: { classId: selectedAddClass } }),
                        });
                        setAddClassBusy(false);
                        setSelectedAddClass("");
                        detail.reload();
                      }}
                      className="btn-sticker rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-bold"
                    >
                      + Tambah
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-title">Judul</Label>
                <Input id="ed-title" value={edit.title ?? t.title} onChange={(e) => setEdit((p) => ({ ...p, title: e.target.value }))} maxLength={200} />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-subject">Mata pelajaran</Label>
                <select
                  id="ed-subject"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={edit.subjectId !== undefined ? (edit.subjectId ?? "") : (t.subject?.id ?? "")}
                  onChange={(e) => setEdit((p) => ({ ...p, subjectId: e.target.value || null }))}
                >
                  <option value="">— Tidak ada —</option>
                  {mapelOpts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-type">Tipe tugas</Label>
                <select
                  id="ed-type"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={edit.type ?? t.type}
                  onChange={(e) => setEdit((p) => ({ ...p, type: e.target.value }))}
                >
                  {Object.entries(TASK_TYPE_LABEL).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-instr">Instruksi (markdown)</Label>
                <Textarea id="ed-instr" rows={5} value={edit.instruction ?? t.instruction} onChange={(e) => setEdit((p) => ({ ...p, instruction: e.target.value }))} />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-deadline">Tenggat</Label>
                <Input
                  id="ed-deadline"
                  type="datetime-local"
                  value={edit.deadline !== undefined ? edit.deadline : (t.deadline ? new Date(t.deadline).toISOString().slice(0, 16) : "")}
                  onChange={(e) => setEdit((p) => ({ ...p, deadline: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ed-publishat">Jadwal terbit (publishAt)</Label>
                <Input
                  id="ed-publishat"
                  type="datetime-local"
                  value={edit.publishAt !== undefined ? edit.publishAt : (t.publishAt ? new Date(t.publishAt).toISOString().slice(0, 16) : "")}
                  onChange={(e) => setEdit((p) => ({ ...p, publishAt: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={edit.allowLate !== undefined ? edit.allowLate : t.allowLate} onCheckedChange={(v) => setEdit((p) => ({ ...p, allowLate: v === true }))} />
                Boleh terlambat
              </label>

              <div className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex items-center gap-3">
                  <Label htmlFor="ed-isgroup" className="flex-1">Tugas kelompok</Label>
                  <Switch
                    id="ed-isgroup"
                    checked={edit.isGroup !== undefined ? edit.isGroup : t.isGroup}
                    onCheckedChange={(v) => setEdit((p) => ({ ...p, isGroup: v }))}
                  />
                </div>
                {(edit.isGroup !== undefined ? edit.isGroup : t.isGroup) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="ed-gmin" className="text-xs">Min anggota</Label>
                      <Input
                        id="ed-gmin"
                        type="number"
                        min={1}
                        max={99}
                        className="h-8"
                        value={edit.groupMin !== undefined ? edit.groupMin : t.groupMin}
                        onChange={(e) => setEdit((p) => ({ ...p, groupMin: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="ed-gmax" className="text-xs">Maks anggota</Label>
                      <Input
                        id="ed-gmax"
                        type="number"
                        min={1}
                        max={99}
                        className="h-8"
                        value={edit.groupMax !== undefined ? edit.groupMax : t.groupMax}
                        onChange={(e) => setEdit((p) => ({ ...p, groupMax: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Button variant="sticker" onClick={() => void simpanPengaturan()}>Simpan</Button>
              {editMsg && <p className="text-sm font-bold text-olive-deep">{editMsg}</p>}
            </div>

            {/* Kartu kanan: materi, kategori, status */}
            <div className="card space-y-4 p-5">
              <div>
                <h2 className="font-extrabold">Materi</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {(t.materials ?? []).map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{m.kind === "TEXT" ? m.text?.slice(0, 60) : m.fileName}</span>
                      <Button variant="ghost" size="icon-xs" aria-label="Hapus materi"
                        onClick={async () => { await api(`/api/tasks/${t.id}/materials/${m.id}`, { method: "DELETE" }); detail.reload(); }}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                  {(t.materials ?? []).length === 0 && <li className="text-xs text-muted-foreground">Belum ada materi.</li>}
                </ul>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-extrabold">Kategori unggahan</h3>
                  <Button variant="sticker-ghost" size="sm" onClick={() => setCatOpen(true)}>
                    <PlusIcon className="size-3.5" /> Tambah kategori
                  </Button>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {cats.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <strong>{c.name}</strong>
                        {" "}{c.required ? "(wajib)" : "(opsional)"}{" · "}{c.accept.join(", ")}
                      </span>
                      <Button variant="ghost" size="icon-xs" aria-label={`Hapus kategori ${c.name}`}
                        onClick={() => void hapusKategori(c.id)}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                  {cats.length === 0 && <li className="text-xs text-muted-foreground">Belum ada kategori.</li>}
                </ul>
              </div>

              <div>
                <h3 className="font-extrabold">Status</h3>
                <p className="mt-2 text-sm text-muted-foreground">Ubah status / hapus lewat tombol di atas (menu &quot;Lainnya&quot;).</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog pratinjau pengingat */}
      <Dialog open={!!nudgeTarget} onOpenChange={(o) => { if (!o) { setNudgeTarget(null); setNudgeResult(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kirim pengingat</DialogTitle>
            <DialogDescription>
              {nudgeTarget === "massal" ? `Kirim ke semua siswa yang belum mengumpulkan (${missingCount} siswa).` : `Kirim ke ${nudgeTarget ? nudgeTarget.student.name : ""}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-line bg-paper p-3 text-sm">
            "Yth. Bapak/Ibu, mohon bantuan mengingatkan ananda … tugas "{t.title}" berbatas … WIB …"
            <p className="mt-2 text-xs text-muted-foreground">Pesan lengkap otomatis menyebut nama anak, judul, tenggat WIB, dan tautan masuk.</p>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={nudgeInapp} onCheckedChange={(v) => setNudgeInapp(v === true)} /> Notifikasi dalam aplikasi</label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={nudgeWa} onCheckedChange={(v) => setNudgeWa(v === true)} disabled={!waReady.data?.connected} />
              WhatsApp orang tua {!waReady.data?.connected && <span className="text-xs text-destructive">(sesi WhatsApp putus)</span>}
            </label>
          </div>
          {nudgeResult && (
            <p className="text-sm font-bold text-olive-deep">
              {nudgeResult.summary ? `Terkirim: ${nudgeResult.summary.total} · WA masuk antrean: ${nudgeResult.summary.waQueued}${nudgeResult.summary.noPhone.length ? ` · tanpa nomor ortu: ${nudgeResult.summary.noPhone.join(", ")}` : ""}` : "Gagal mengirim."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNudgeTarget(null); setNudgeResult(null); }}>Tutup</Button>
            <Button onClick={() => void kirimNudge()} disabled={nudgeBusy || (!nudgeInapp && !nudgeWa)}>{nudgeBusy ? "Mengirim…" : "Kirim pengingat"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GroupSheet taskId={t.id} mode="teacher" open={groupOpen} onOpenChange={setGroupOpen} onChanged={() => { roster.reload(); detail.reload(); }} />
      <CategorySheet
        open={catOpen}
        onOpenChange={setCatOpen}
        cats={cats}
        loading={detail.loading}
        busy={catBusy}
        onAdd={(c) => void tambahKategori(c)}
        onRemove={(id) => void hapusKategori(id as string)}
      />

      <ConfirmDialog
        open={confirmHapus}
        title="Hapus tugas?"
        message="Hapus tugas ini? Hanya bisa bila belum ada pengumpulan."
        confirmLabel="Hapus"
        onCancel={() => setConfirmHapus(false)}
        onConfirm={async () => { setConfirmHapus(false); await hapusTugas(); }}
      />
      <ConfirmDialog
        open={!!confirmHapusKelas}
        title="Hapus dari kelas?"
        message={`Hapus penugasan dari kelas ${t.targets?.find((tg) => tg.classId === confirmHapusKelas)?.class.name ?? ""}?`}
        confirmLabel="Hapus"
        onCancel={() => setConfirmHapusKelas(null)}
        onConfirm={async () => {
          if (!confirmHapusKelas) return;
          await api(`/api/tasks/${t.id}?scope=kelas&classId=${confirmHapusKelas}`, { method: "DELETE" });
          setConfirmHapusKelas(null);
          detail.reload();
        }}
      />
    </div>
  );
}
