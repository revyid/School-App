"use client";

// /guru/tugas/new — buat tugas baru dengan semua fitur:
// status draf/terbit, jadwal terbit, deadline, mapel, tipe, kelompok, kategori unggahan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CategorySheet from "@/components/CategorySheet";
import { TASK_TYPE_LABEL } from "@sms/shared/lms";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/* ── types ──────────────────────────────────────────────── */
interface Category {
  name: string;
  instruction: string;
  required: boolean;
  accept: ("PDF" | "IMAGE" | "VIDEO" | "DOC")[];
}

/* ── helpers ─────────────────────────────────────────────── */
function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-bold text-muted-strong uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-strong">{hint}</span>}
    </label>
  );
}

function Divider() {
  return <hr className="border-line my-1" />;
}

/* ── page ────────────────────────────────────────────────── */
export default function TugasNewPage() {
  const router = useRouter();

  /* data remote */
  const assignments = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (assignments.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const subjects = useFetch<{ rows: { id: string; name: string }[] }>("/api/subjects");

  /* field utama */
  const [classId, setClassId] = useState("");
  const [extraClassIds, setExtraClassIds] = useState<string[]>([]);
  // Mapel per kelas dari jadwal (auto-mapping); fallback global bila kelas belum punya slot.
  const mapelKelas = useFetch<{ subjects: { id: string | null; name: string }[] }>(
    classId ? `/api/timetable/subjects?classId=${classId}` : null,
  );
  const mapelOpts = (mapelKelas.data && mapelKelas.data.subjects.length > 0)
    ? mapelKelas.data.subjects.filter((s) => s.id).map((s) => ({ id: s.id as string, name: s.name }))
    : (subjects.data?.rows ?? []);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [type, setType] = useState("REGULAR");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("PUBLISHED");
  const [deadline, setDeadline] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [allowLate, setAllowLate] = useState(false);

  /* kelompok */
  const [isGroup, setIsGroup] = useState(false);
  const [groupMin, setGroupMin] = useState(2);
  const [groupMax, setGroupMax] = useState(5);

  /* kategori unggahan */
  const [cats, setCats] = useState<Category[]>([]);
  const [catOpen, setCatOpen] = useState(false);

  /* submit state */
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ── kategori helpers ── */
  function removeCat(i: number) { setCats((c) => c.filter((_, j) => j !== i)); }

  /* ── submit ── */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) { setErr("Pilih kelas dulu"); return; }
    if (isGroup && groupMin > groupMax) { setErr("Anggota min tidak boleh > maks"); return; }

    setSaving(true);
    setErr(null);

    const allClassIds = classId ? [classId, ...extraClassIds.filter((id) => id !== classId)] : [];
    const dlIso = deadline ? new Date(deadline).toISOString() : null;
    const pubIso = publishAt ? new Date(publishAt).toISOString() : null;

    const body = {
      classId,
      classTargets: allClassIds.map((cid) => ({
        classId: cid,
        status,
        deadline: dlIso,
        publishAt: pubIso,
        allowLate,
      })),
      subjectId: subjectId || null,
      title,
      instruction,
      type,
      status,
      deadline: dlIso,
      publishAt: pubIso,
      allowLate,
      isGroup,
      groupMin,
      groupMax,
      categories: cats.length
        ? cats.map((c, i) => ({ ...c, position: i }))
        : undefined,
    };

    const res = await api("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(d.error || `Gagal (${res.status})`); return; }
    router.push("/guru/tugas");
  }

  /* ── render ── */
  return (
    <>
      <PageHead kicker="Belajar" title="Buat tugas baru" desc="Isi detail tugas, atur jadwal, kategori unggahan, dan kelompok." />

      <form onSubmit={submit} className="grid gap-5 max-w-2xl">

        {/* ── Identitas ── */}
        <Card>
          <h2 className="display mb-4 text-[15px]">Identitas tugas</h2>
          <div className="grid gap-4">

            <Field label="Kelas utama" hint="Kelas utama target tugas ini.">
              <Select value={classId} onValueChange={(v) => { setClassId(v ?? ""); setExtraClassIds((prev) => prev.filter((id) => id !== (v ?? ""))); }}>
                <SelectTrigger><SelectValue placeholder="— Pilih kelas… —" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {kelasUnik.map((r) => (
                    <SelectItem key={r.class.id} value={r.class.id}>{r.class.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </Field>

            {classId && kelasUnik.length > 1 && (
              <div className="grid gap-2 rounded-xl border border-line bg-paper/50 p-3">
                <span className="text-[12px] font-bold text-muted-strong uppercase tracking-wide">
                  Tugaskan juga ke kelas lain (opsional)
                </span>
                <div className="flex flex-wrap gap-3">
                  {kelasUnik.filter((r) => r.class.id !== classId).map((r) => (
                    <label key={r.class.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extraClassIds.includes(r.class.id)}
                        onChange={(e) => {
                          if (e.target.checked) setExtraClassIds((prev) => [...prev, r.class.id]);
                          else setExtraClassIds((prev) => prev.filter((id) => id !== r.class.id));
                        }}
                      />
                      <span>{r.class.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Field label="Mata pelajaran (opsional)">
              <Select value={subjectId} onValueChange={(v) => setSubjectId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="— Pilih mapel… —" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {mapelOpts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </Field>

            <Field label="Judul tugas">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Tugas Bab 3 — Fotosintesis"
                required
                maxLength={200}
              />
            </Field>

            <Field label="Tipe tugas">
              <Select value={type} onValueChange={(v) => setType(v ?? "TUGAS")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </Field>

          </div>
        </Card>

        {/* ── Instruksi ── */}
        <Card>
          <h2 className="display mb-2 text-[15px]">Instruksi</h2>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            required
            rows={8}
            placeholder="Tuliskan instruksi tugas di sini…"
            className="w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink/30"
          />
        </Card>

        {/* ── Jadwal & Status ── */}
        <Card>
          <h2 className="display mb-4 text-[15px]">Jadwal & status</h2>
          <div className="grid gap-4">

            <div className="flex flex-wrap gap-4">
              <label
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition-colors", status === "PUBLISHED" ? "border-ink bg-ink text-cream" : "border-ink/20 bg-cream text-muted-strong")}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="status"
                  value="PUBLISHED"
                  checked={status === "PUBLISHED"}
                  onChange={() => setStatus("PUBLISHED")}
                />
                Terbit
              </label>
              <label
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition-colors", status === "DRAFT" ? "border-ink bg-ink text-cream" : "border-ink/20 bg-cream text-muted-strong")}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name="status"
                  value="DRAFT"
                  checked={status === "DRAFT"}
                  onChange={() => setStatus("DRAFT")}
                />
                Simpan draf
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label="Jadwal terbit (opsional)" hint="Kosongkan = terbit sekarang">
                <Input
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                />
              </Field>
              <Field label="Deadline (opsional)">
                <Input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={allowLate}
                onChange={(e) => setAllowLate(e.target.checked)}
                className="size-4"
              />
              Izinkan pengumpulan terlambat
            </label>

          </div>
        </Card>

        {/* ── Kelompok ── */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-[15px]">Kerja kelompok</h2>
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={isGroup}
                onChange={(e) => setIsGroup(e.target.checked)}
                className="size-4"
              />
              Aktifkan
            </label>
          </div>
          {isGroup ? (
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label="Min anggota">
                <Input
                  type="number"
                  value={String(groupMin)}
                  onChange={(e) => setGroupMin(Number(e.target.value))}
                  min={2}
                  max={10}
                />
              </Field>
              <Field label="Maks anggota">
                <Input
                  type="number"
                  value={String(groupMax)}
                  onChange={(e) => setGroupMax(Number(e.target.value))}
                  min={2}
                  max={10}
                />
              </Field>
            </div>
          ) : (
            <Alert>Centang "Aktifkan" bila tugas ini dikerjakan berkelompok.</Alert>
          )}
        </Card>

        {/* ── Kategori unggahan ── */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="display text-[15px]">Kategori unggahan</h2>
              <p className="mt-0.5 text-[12px] text-muted-strong">
                Opsional — tentukan jenis file yang boleh dikumpulkan per kategori.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCatOpen(true)}
              className="btn-sticker flex items-center gap-1.5 rounded-2xl border border-line bg-cream px-3 py-1.5 text-[12px] font-bold hover:bg-paper"
            >
              <PlusIcon size={13} /> Tambah
            </button>
          </div>

          {cats.length === 0 && (
            <Alert>Belum ada kategori. Klik "Tambah" untuk menambah.</Alert>
          )}

          <ul className="grid gap-2">
            {cats.map((cat, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-paper px-3 py-2 text-sm">
                <span className="truncate"><strong>{cat.name || `Kategori ${i + 1}`}</strong>{cat.required ? " (wajib)" : ""} · {cat.accept.join(", ")}</span>
                <button type="button" onClick={() => removeCat(i)} className="rounded-xl p-1 text-muted-strong hover:text-terracotta" aria-label={`Hapus kategori ${i + 1}`}>
                  <Trash2Icon size={14} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <CategorySheet
          open={catOpen}
          onOpenChange={setCatOpen}
          cats={cats}
          busy={saving}
          onAdd={(c) => setCats((prev) => [...prev, { name: c.name, instruction: c.instruction, required: c.required, accept: c.accept as Category["accept"] }])}
          onRemove={(i) => removeCat(i as number)}
        />

        {/* ── Error & submit ── */}
        {err && <Alert variant="destructive">{err}</Alert>}

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Button variant="sticker-ghost" type="button" onClick={() => router.back()}>Batal</Button>
          <Button variant="sticker" type="submit" disabled={saving}>
            {saving
              ? "Menyimpan…"
              : status === "DRAFT" ? "Simpan draf" : "Terbitkan tugas"}
          </Button>
        </div>

      </form>
    </>
  );
}
