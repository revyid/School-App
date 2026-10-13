"use client";

// /guru/asesmen/new — buat asesmen baru: soal massal, bank soal, pengaturan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, useFetch } from "@/app/lib/api";
import AssessmentStemMarkdown from "@/components/AssessmentStemMarkdown";
import UploadPopup from "@/components/UploadPopup";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Note, Err } from "@/components/DashUI";
import { parseMultiQuestions, PLACEHOLDER_EXAMPLE } from "@/lib/parse-questions";
import { PlusIcon, Trash2Icon, CheckIcon } from "lucide-react";

interface BankRow {
  id: string; type: string; stem: string;
  imageName: string | null; videoName: string | null; options: string[];
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-bold text-muted-strong uppercase tracking-wide">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-strong">{hint}</span>}
    </label>
  );
}

export default function AsesmenNewPage() {
  const router = useRouter();
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );

  // Form utama
  const [classId, setClassId] = useState("");
  const [extraClassIds, setExtraClassIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [showChart, setShowChart] = useState(true);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleOpt, setShuffleOpt] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [rawText, setRawText] = useState(PLACEHOLDER_EXAMPLE);
  const { questions: parsed, errors: parseErrors } = parseMultiQuestions(rawText);

  // Bank soal
  const bank = useFetch<{ rows: BankRow[] }>("/api/questions");
  const [picked, setPicked] = useState<string[]>([]);

  // Tambah ke bank
  const [addOpen, setAddOpen] = useState(false);
  const [bStem, setBStem] = useState("");
  const [bType, setBType] = useState("MCQ");
  const [bOpts, setBOpts] = useState("a \nb \nc ");
  const [bCorrect, setBCorrect] = useState("0");
  const [bImg, setBImg] = useState<File | null>(null);
  const [bVid, setBVid] = useState<File | null>(null);
  const [bankMsg, setBankMsg] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function tambahBank(e: React.FormEvent) {
    e.preventDefault();
    const opts = bOpts.split("\n").map((s) => s.replace(/^[a-hA-H\d][.)\-:]?\s+/, "").trim()).filter(Boolean);
    if (!bStem.trim() || opts.length < 2) { setBankMsg("Isi batang soal + minimal 2 opsi"); return; }
    const form = new FormData();
    form.append("type", bType);
    form.append("stem", bStem);
    form.append("options", JSON.stringify(opts));
    form.append("correctIndex", bType === "MCQ" ? bCorrect : "");
    if (bImg) form.append("image", bImg);
    if (bVid) form.append("video", bVid);
    const res = await api("/api/questions", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBankMsg(d.error || `Gagal (${res.status})`); return; }
    setBankMsg("Soal masuk bank");
    setBStem(""); setBOpts("a \nb \nc "); setBImg(null); setBVid(null);
    bank.reload();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) { setErr("Pilih kelas dulu"); return; }
    if (parsed.length === 0 && picked.length === 0) { setErr("Pilih soal dari bank atau tulis soal massal"); return; }
    setSaving(true);
    setErr(null);
    const allClassIds = classId ? [classId, ...extraClassIds.filter((id) => id !== classId)] : [];
    const dlIso = deadline ? new Date(deadline).toISOString() : null;
    const res = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId,
        classTargets: allClassIds.map((cid) => ({
          classId: cid,
          deadline: dlIso,
        })),
        title,
        showChart,
        shuffleQ,
        shuffleOpt,
        deadline: dlIso,
        durationMin: durationMin ? Number(durationMin) : null,
        questionIds: picked,
        inline: parsed.map((q) => ({
          type: q.type,
          stem: q.stem,
          options: q.options,
          correctIndex: q.type === "MCQ" ? q.correctIndex : null,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(d.error || `Gagal (${res.status})`); return; }
    router.push("/guru/tugas?jenis=asesmen");
  }

  return (
    <>
      <PageHead kicker="Ujian" title="Buat asesmen baru" desc="Tulis soal massal, pilih dari bank soal, atur jadwal." />

      <form onSubmit={submit} className="grid gap-5 max-w-2xl">

        {/* Identitas */}
        <Panel>
          <h2 className="display mb-4 text-[15px]">Identitas asesmen</h2>
          <div className="grid gap-4">
            <Field label="Kelas utama" hint="Kelas utama target asesmen ini.">
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

            <Field label="Judul asesmen / ujian">
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mis. Ulangan Harian Bab 1"
                required
                maxLength={200}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label="Deadline (opsional)">
                <TextInput
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </Field>
              <Field label="Durasi menit (opsional)">
                <TextInput
                  type="number"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="mis. 60"
                  min={1}
                  max={480}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} className="size-4" />
                Tampilkan chart ke murid
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)} className="size-4" />
                Acak urutan soal
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={shuffleOpt} onChange={(e) => setShuffleOpt(e.target.checked)} className="size-4" />
                Acak opsi jawaban
              </label>
            </div>
          </div>
        </Panel>

        {/* Soal massal */}
        <Panel>
          <h2 className="display mb-1 text-[15px]">Soal massal</h2>
          <p className="mb-4 text-[12px] text-muted-strong">
            Tulis (BENAR) di akhir opsi yang benar. Tipe: (SORTING) mengurutkan, (ISIAN: jawaban).
          </p>
          <div className="grid gap-3">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              className="rounded-2xl border border-line bg-cream px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ink/30"
            />

            <div className="rounded-2xl border border-line bg-paper p-3 text-[12px]">
              <strong>Pratinjau:</strong>
              <div className="mt-2">
                <AssessmentStemMarkdown content={rawText} imageAsButton />
              </div>
            </div>

            <div className="rounded-2xl bg-cream px-3 py-2.5 text-[12px]">
              <strong>{parsed.length} soal terdeteksi</strong>
              {parseErrors.length > 0 && (
                <ul className="mt-1.5 list-disc pl-4 text-terracotta">
                  {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              <ul className="mt-1.5 list-disc pl-4 text-muted-strong">
                {parsed.map((q, idx) => (
                  <li key={idx}>
                    [{q.rawType}] {q.stem.split("\n")[0].slice(0, 60)}
                    {q.type === "MCQ" && q.correctIndex != null && ` — benar: ${q.options[q.correctIndex]}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        {/* Bank soal */}
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="display text-[15px]">Bank soal ({picked.length} dipilih)</h2>
              <p className="mt-0.5 text-[12px] text-muted-strong">Centang soal dari bank untuk dimasukkan ke asesmen ini.</p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="btn-sticker flex items-center gap-1.5 rounded-2xl border border-line bg-cream px-3 py-1.5 text-[12px] font-bold hover:bg-paper"
            >
              <PlusIcon size={13} /> Tambah soal
            </button>
          </div>

          {bank.loading && <Note>Memuat bank soal…</Note>}
          {bank.error && <Err>Gagal: {bank.error}</Err>}
          {bank.data && (bank.data.rows ?? []).length === 0 && <Note>Bank masih kosong. Tambah soal di atas.</Note>}

          <div className="grid gap-2">
            {(bank.data?.rows ?? []).slice(0, 50).map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3 transition-colors"
                style={{ background: picked.includes(b.id) ? "#eeeadd" : "#fffdf8" }}
              >
                <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-line" style={picked.includes(b.id) ? { background: "#50643e", borderColor: "#50643e" } : {}}>
                  {picked.includes(b.id) && <CheckIcon size={12} color="#fff" />}
                  <input type="checkbox" className="sr-only" checked={picked.includes(b.id)} onChange={() => togglePick(b.id)} />
                </span>
                <span className="min-w-0 flex-1 text-[13px]">
                  <AssessmentStemMarkdown content={b.stem} />
                  {b.imageName && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/assess-files/${b.id}/${b.imageName}`} alt="gambar soal" loading="lazy" className="mt-2 max-w-[280px] rounded-xl" />
                  )}
                  {b.videoName && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={`/api/assess-files/${b.id}/${b.videoName}`} controls preload="metadata" className="mt-2 max-w-[280px] rounded-xl" />
                  )}
                  <span className="mt-1 block text-[11px] text-muted-strong">[{b.type}] {b.options.length} opsi</span>
                </span>
              </label>
            ))}
          </div>

          {/* Form tambah ke bank */}
          {addOpen && (
            <div className="mt-4 rounded-2xl border border-line bg-paper p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="display text-[14px]">Tambah soal ke bank</h3>
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-xl p-1 text-muted-strong hover:bg-cream">
                  <Trash2Icon size={14} />
                </button>
              </div>
              <form onSubmit={tambahBank} className="grid gap-3">
                <Field label="Tipe">
                  <TextSelect value={bType} onChange={(e) => setBType(e.target.value)}>
                    <option value="MCQ">Pilihan ganda</option>
                    <option value="SORTING">Mengurutkan</option>
                  </TextSelect>
                </Field>
                <Field label="Batang soal">
                  <textarea
                    value={bStem}
                    onChange={(e) => setBStem(e.target.value)}
                    required
                    rows={3}
                    className="rounded-2xl border border-line bg-cream px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30"
                  />
                </Field>
                <Field label="Opsi (satu per baris)">
                  <textarea
                    value={bOpts}
                    onChange={(e) => setBOpts(e.target.value)}
                    required
                    rows={4}
                    className="rounded-2xl border border-line bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30"
                  />
                </Field>
                {bType === "MCQ" && (
                  <Field label="Index jawaban benar (0 = opsi pertama)">
                    <TextInput value={bCorrect} onChange={(e) => setBCorrect(e.target.value)} inputMode="numeric" />
                  </Field>
                )}
                <Field label="Gambar soal (JPG/PNG, maks 5MB, opsional)">
                  <UploadPopup
                    accept="image/jpeg,image/png,image/webp"
                    maxMb={5}
                    onFile={(f) => setBImg(f)}
                    label={bImg?.name}
                  />
                </Field>
                <Field label="Video soal (MP4/WebM, maks 20MB, opsional)">
                  <UploadPopup
                    accept="video/mp4,video/webm"
                    maxMb={20}
                    onFile={(f) => setBVid(f)}
                    label={bVid?.name}
                  />
                </Field>
                {bankMsg && <p className="text-[12px] font-bold" style={{ color: bankMsg.includes("bank") ? "#50643e" : "#c94b35" }}>{bankMsg}</p>}
                <Toolbar><Btn type="submit">Simpan ke bank</Btn></Toolbar>
              </form>
            </div>
          )}
        </Panel>

        {err && <p className="text-[13px] font-bold text-terracotta">{err}</p>}

        <Toolbar>
          <Btn type="button" kind="ghost" onClick={() => router.back()}>Batal</Btn>
          <Btn type="submit" disabled={saving || (parsed.length === 0 && picked.length === 0)}>
            {saving ? "Menyimpan…" : `Buat ${parsed.length + picked.length} soal`}
          </Btn>
        </Toolbar>
      </form>
    </>
  );
}
