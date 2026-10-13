"use client";

// /guru/tugas/new — buat tugas baru dengan semua fitur:
// status draf/terbit, jadwal terbit, deadline, mapel, tipe, kelompok, kategori unggahan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Note, Err } from "@/components/DashUI";
import { TASK_TYPE_LABEL, UPLOAD_ACCEPT_LABEL } from "@sms/shared/lms";
import { PlusIcon, Trash2Icon } from "lucide-react";

/* ── types ──────────────────────────────────────────────── */
interface Category {
  name: string;
  instruction: string;
  required: boolean;
  accept: ("PDF" | "IMAGE" | "VIDEO" | "DOC")[];
}

const EMPTY_CAT = (): Category => ({
  name: "", instruction: "", required: false, accept: ["PDF"],
});

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

  /* submit state */
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ── kategori helpers ── */
  function addCat() { setCats((c) => [...c, EMPTY_CAT()]); }
  function removeCat(i: number) { setCats((c) => c.filter((_, j) => j !== i)); }
  function patchCat<K extends keyof Category>(i: number, key: K, val: Category[K]) {
    setCats((c) => c.map((cat, j) => (j === i ? { ...cat, [key]: val } : cat)));
  }
  function toggleAccept(i: number, acc: "PDF" | "IMAGE" | "VIDEO" | "DOC") {
    const cur = cats[i].accept;
    const next = cur.includes(acc) ? cur.filter((x) => x !== acc) : [...cur, acc];
    if (next.length === 0) return; // minimal 1
    patchCat(i, "accept", next as Category["accept"]);
  }

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
        <Panel>
          <h2 className="display mb-4 text-[15px]">Identitas tugas</h2>
          <div className="grid gap-4">

            <Field label="Kelas utama" hint="Kelas utama target tugas ini.">
              <TextSelect
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setExtraClassIds((prev) => prev.filter((id) => id !== e.target.value));
                }}
                required
              >
                <option value="">— pilih kelas —</option>
                {kelasUnik.map((r) => (
                  <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
                ))}
              </TextSelect>
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
              <TextSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">— tanpa mapel —</option>
                {mapelOpts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </TextSelect>
            </Field>

            <Field label="Judul tugas">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Tugas Bab 3 — Fotosintesis"
                required
                maxLength={200}
              />
            </Field>

            <Field label="Tipe tugas">
              <TextSelect value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </TextSelect>
            </Field>

          </div>
        </Panel>

        {/* ── Instruksi ── */}
        <Panel>
          <h2 className="display mb-2 text-[15px]">Instruksi</h2>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            required
            rows={8}
            placeholder="Tuliskan instruksi tugas di sini…"
            className="w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ink/30"
          />
        </Panel>

        {/* ── Jadwal & Status ── */}
        <Panel>
          <h2 className="display mb-4 text-[15px]">Jadwal & status</h2>
          <div className="grid gap-4">

            <div className="flex flex-wrap gap-4">
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition-colors"
                style={status === "PUBLISHED"
                  ? { background: "#171716", color: "#fffdf8", borderColor: "#171716" }
                  : { background: "#fffdf8", color: "#575752", borderColor: "rgba(23,23,22,.2)" }}
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
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-[13px] font-bold transition-colors"
                style={status === "DRAFT"
                  ? { background: "#171716", color: "#fffdf8", borderColor: "#171716" }
                  : { background: "#fffdf8", color: "#575752", borderColor: "rgba(23,23,22,.2)" }}
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
                <TextInput
                  type="datetime-local"
                  value={publishAt}
                  onChange={(e) => setPublishAt(e.target.value)}
                />
              </Field>
              <Field label="Deadline (opsional)">
                <TextInput
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
        </Panel>

        {/* ── Kelompok ── */}
        <Panel>
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
                <TextInput
                  type="number"
                  value={String(groupMin)}
                  onChange={(e) => setGroupMin(Number(e.target.value))}
                  min={2}
                  max={10}
                />
              </Field>
              <Field label="Maks anggota">
                <TextInput
                  type="number"
                  value={String(groupMax)}
                  onChange={(e) => setGroupMax(Number(e.target.value))}
                  min={2}
                  max={10}
                />
              </Field>
            </div>
          ) : (
            <Note>Centang "Aktifkan" bila tugas ini dikerjakan berkelompok.</Note>
          )}
        </Panel>

        {/* ── Kategori unggahan ── */}
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="display text-[15px]">Kategori unggahan</h2>
              <p className="mt-0.5 text-[12px] text-muted-strong">
                Opsional — tentukan jenis file yang boleh dikumpulkan per kategori.
              </p>
            </div>
            <button
              type="button"
              onClick={addCat}
              className="btn-sticker flex items-center gap-1.5 rounded-2xl border border-line bg-cream px-3 py-1.5 text-[12px] font-bold hover:bg-paper"
            >
              <PlusIcon size={13} /> Tambah
            </button>
          </div>

          {cats.length === 0 && (
            <Note>Belum ada kategori. Klik "Tambah" untuk menambah.</Note>
          )}

          <div className="grid gap-3">
            {cats.map((cat, i) => (
              <div
                key={i}
                className="rounded-2xl border border-line bg-paper p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-muted-strong uppercase tracking-wide">
                    Kategori {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCat(i)}
                    className="rounded-xl p-1 text-muted-strong hover:text-terracotta"
                  >
                    <Trash2Icon size={14} />
                  </button>
                </div>

                <div className="grid gap-3">
                  <Field label="Nama kategori">
                    <TextInput
                      value={cat.name}
                      onChange={(e) => patchCat(i, "name", e.target.value)}
                      placeholder="mis. Laporan, Presentasi, Video…"
                      required
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Instruksi kategori (opsional)">
                    <textarea
                      value={cat.instruction}
                      onChange={(e) => patchCat(i, "instruction", e.target.value)}
                      rows={2}
                      maxLength={10000}
                      placeholder="Catatan khusus untuk kategori ini…"
                      className="rounded-2xl border border-line bg-cream px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30"
                    />
                  </Field>

                  <div>
                    <span className="mb-1.5 block text-[12px] font-bold text-muted-strong uppercase tracking-wide">
                      Tipe file diterima
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(UPLOAD_ACCEPT_LABEL) as ("PDF" | "IMAGE" | "VIDEO" | "DOC")[]).map((acc) => (
                        <label
                          key={acc}
                          className="flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors"
                          style={cat.accept.includes(acc)
                            ? { background: "#50643e", color: "#fff", borderColor: "#50643e" }
                            : { background: "#fffdf8", color: "#575752", borderColor: "rgba(23,23,22,.2)" }}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={cat.accept.includes(acc)}
                            onChange={() => toggleAccept(i, acc)}
                          />
                          {UPLOAD_ACCEPT_LABEL[acc]}
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={cat.required}
                      onChange={(e) => patchCat(i, "required", e.target.checked)}
                      className="size-4"
                    />
                    Wajib dikumpulkan
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Error & submit ── */}
        {err && <Err>{err}</Err>}

        <Toolbar>
          <Btn type="button" kind="ghost" onClick={() => router.back()}>Batal</Btn>
          <Btn type="submit" disabled={saving}>
            {saving
              ? "Menyimpan…"
              : status === "DRAFT" ? "Simpan draf" : "Terbitkan tugas"}
          </Btn>
        </Toolbar>

      </form>
    </>
  );
}
