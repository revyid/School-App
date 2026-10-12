"use client";

// Guru: daftar asesmen tampil lebih dulu; form pembuatan dibuka terpisah.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import AssessmentQuestionEditor from "@/components/AssessmentQuestionEditor";
import AssessmentStemMarkdown from "@/components/AssessmentStemMarkdown";

interface Row {
  id: string; kind: string; title: string; publishAt: string; deadline: string | null;
  class?: { name: string }; subject?: { name: string } | null;
  _count?: { questions: number; attempts: number };
}
type ParsedQ = { type: "MCQ" | "SORTING"; stem: string; options: string[]; correctIndex: number | null };

function parseMultiQuestions(raw: string): ParsedQ[] {
  const blocks = raw.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const result: ParsedQ[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const firstLine = lines[0];
    const isSorting = firstLine.toLowerCase().includes("(sorting)") || firstLine.toLowerCase().includes("urutkan");
    const stem = firstLine.replace(/^\d+[.)]\s*/, "").replace(/\s*\(sorting\)/i, "").trim();
    const bodyLines = lines.slice(1);
    const imageLines = bodyLines.filter((line) => /^\(IMG\)$/i.test(line) || /^!\[[^\]]*\]\([^)]+\)$/.test(line));
    const optionLines = bodyLines.filter((line) => !imageLines.includes(line));
    const options: string[] = [];

    if (isSorting) {
      for (const line of optionLines) {
        const option = line.replace(/^[a-zA-Z\d]+[.)]\s*/, "").trim();
        if (option) options.push(option);
      }
      if (options.length >= 2) result.push({ type: "SORTING", stem: [stem, ...imageLines].filter(Boolean).join("\n"), options, correctIndex: null });
      continue;
    }

    let correctIndex: number | null = null;
    for (const line of optionLines) {
      const marked = /\s*\(benar\)|\s*\*$/.test(line.toLowerCase());
      const option = line.replace(/^[a-zA-Z\d]+[.)]\s*/, "").replace(/\s*\(benar\)|\s*\*$/i, "").trim();
      if (!option) continue;
      options.push(option);
      if (marked) correctIndex = options.length - 1;
    }
    if (options.length >= 2 && correctIndex !== null) {
      result.push({ type: "MCQ", stem: [stem, ...imageLines].filter(Boolean).join("\n"), options, correctIndex });
    }
  }
  return result;
}

const PLACEHOLDER_EXAMPLE = `1. Ibu kota negara Indonesia adalah...
a Surabaya
b Jakarta (BENAR)
c Bandung
d Medan

2. Urutkan siklus air (SORTING)
Evaporasi
Kondensasi
Presipitasi`;

function dateInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AsesmenGuruPage() {
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>("/api/assessments");
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (classes.data?.rows ?? []).filter((row, i, all) => all.findIndex((x) => x.class.id === row.class.id) === i);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("REGULAR");
  const [instruction, setInstruction] = useState("");
  const [deadline, setDeadline] = useState("");
  const [publishAt, setPublishAt] = useState("");
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleOpt, setShuffleOpt] = useState(true);
  const [rawText, setRawText] = useState(PLACEHOLDER_EXAMPLE);
  const [creating, setCreating] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [filterClass, setFilterClass] = useState("");
  const [searchText, setSearchText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const analysis = useFetch<{ items: { questionId: string; stem: string; n: number; difficulty: number; distractors: Record<string, number> }[]; attempts: number }>(sel ? `/api/assessments/${sel}/analysis` : null);
  const diag = useFetch<{ n: number; avg: number; buckets: number[] }>(sel ? `/api/assessments/${sel}/diagnostic` : null);
  const parsed = parseMultiQuestions(rawText);
  const filteredRows = (data?.rows ?? []).filter((row) =>
    (!filterClass || (row as Row & { classId?: string }).classId === filterClass)
    && (!searchText.trim() || row.title.toLowerCase().includes(searchText.trim().toLowerCase())));

  async function buat(event: React.FormEvent) {
    event.preventDefault();
    setMsg(null);
    if (!classId) { setMsg("Pilih kelas dulu."); return; }
    if (!title.trim()) { setMsg("Judul asesmen wajib diisi."); return; }
    if (!parsed.length) { setMsg("Belum ada soal valid. Pastikan MCQ punya minimal 2 opsi dan satu tanda (BENAR), atau sorting punya minimal 2 item."); return; }
    if (/\(IMG\)/i.test(rawText)) { setMsg("Unggah gambar pada setiap tombol IMG terlebih dahulu."); return; }
    const response = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, title: title.trim(), kind, instruction: instruction || null,
        deadline: dateInput(deadline), publishAt: dateInput(publishAt),
        shuffleQ, shuffleOpt,
        inline: parsed.map((question) => ({
          type: question.type, stem: question.stem, options: question.options,
          correctIndex: question.type === "MCQ" ? question.correctIndex : null,
        })),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setMsg(result.error || `Gagal (${response.status})`); return; }
    setMsg(`Asesmen "${title.trim()}" berhasil dibuat dengan ${parsed.length} soal.`);
    setTitle(""); setInstruction(""); setDeadline(""); setPublishAt(""); setRawText(PLACEHOLDER_EXAMPLE);
    setCreating(false); reload();
  }

  const rows = filteredRows as (Row & { classId?: string })[];
  return (
    <>
      <PageHead
        kicker="Ujian"
        title="Asesmen kelas"
        desc="Daftar asesmen, progres siswa, analisis butir, dan pembuatan asesmen baru."
        right={<Btn kind={creating ? "ghost" : "dark"} type="button" onClick={() => { setCreating((value) => !value); setMsg(null); }}>{creating ? "Tutup form" : "+ Buat asesmen"}</Btn>}
      />
      {msg && <p role="status" style={{ margin: "0 0 12px", fontWeight: 700, color: msg.includes("berhasil") ? "#50643e" : "#a33" }}>{msg}</p>}

      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Daftar Asesmen</h2>
        <Toolbar>
          <TextInput value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Cari judul asesmen…" aria-label="Cari asesmen" />
          <TextSelect value={filterClass} onChange={(event) => setFilterClass(event.target.value)} aria-label="Filter kelas">
            <option value="">Semua kelas</option>
            {kelasUnik.map((row) => <option key={row.class.id} value={row.class.id}>{row.class.name}</option>)}
          </TextSelect>
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && !filteredRows.length && <Note>{data.rows.length ? "Tidak ada asesmen yang cocok dengan filter." : "Belum ada asesmen. Gunakan tombol Buat asesmen untuk memulai."}</Note>}
        {rows.length > 0 && (
          <WarmTable head={["Judul", "Kelas / Mapel", "Jenis", "Terbit / Tenggat", "Soal", "Sudah mulai", "Aksi"]}>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={warmCell({ fontWeight: 700 })}>{row.title}</td>
                <td style={warmCell()}>{row.class?.name ?? "-"}{row.subject?.name ? ` · ${row.subject.name}` : ""}</td>
                <td style={warmCell()}><Badge status={row.kind === "DIAGNOSTIC" ? "IZIN" : "AKTIF"}>{row.kind}</Badge></td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>
                  <div>Terbit: {new Date(row.publishAt).toLocaleString("id-ID")}</div>
                  <div>Tenggat: {row.deadline ? new Date(row.deadline).toLocaleString("id-ID") : "-"}</div>
                </td>
                <td style={warmCell()}>{row._count?.questions ?? "?"}</td>
                <td style={warmCell()}>{row._count?.attempts ?? "?"}</td>
                <td style={warmCell()}><Btn kind="ghost" type="button" onClick={() => { setSel(sel === row.id ? null : row.id); setMsg(null); }}>{sel === row.id ? "Tutup analisis" : "Analisis"}</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>

      {creating && <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Buat Asesmen Baru</h2>
        <form onSubmit={buat} style={{ display: "grid", gap: 12, maxWidth: 760 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Kelas:
            <TextSelect value={classId} onChange={(event) => setClassId(event.target.value)} required>
              <option value="">— pilih kelas —</option>
              {kelasUnik.map((row) => <option key={row.class.id} value={row.class.id}>{row.class.name}</option>)}
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Judul asesmen:
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="misal: Ulangan Harian Bab 1" required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Jenis asesmen:
            <TextSelect value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="REGULAR">REGULAR (Nilai biasa)</option>
              <option value="DIAGNOSTIC">DIAGNOSTIC (Asesmen awal)</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Instruksi untuk siswa (opsional):
            <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={10000} rows={3} style={{ borderRadius: 12, border: "1px solid #ccc", padding: 10, font: "inherit" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>Terbit pada (kosong = sekarang)<input type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} style={{ borderRadius: 10, border: "1px solid #ccc", padding: 9 }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>Tenggat (opsional)<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} style={{ borderRadius: 10, border: "1px solid #ccc", padding: 9 }} /></label>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
            <label><input type="checkbox" checked={shuffleQ} onChange={(event) => setShuffleQ(event.target.checked)} /> Acak urutan soal</label>
            <label><input type="checkbox" checked={shuffleOpt} onChange={(event) => setShuffleOpt(event.target.checked)} /> Acak pilihan/item</label>
          </div>
          <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            <strong>Soal massal (MCQ / sorting):</strong>
            <AssessmentQuestionEditor value={rawText} onChange={setRawText} classId={classId} />
            <span style={{ fontSize: 11, color: "#8a8a82" }}>MCQ wajib memiliki satu opsi bertanda (BENAR). Untuk sorting, tambahkan (SORTING) pada judul dan tulis item dalam urutan jawaban yang benar. Ketik (IMG) di stem untuk menambah gambar.</span>
          </div>
          <div style={{ background: "#f0ede3", padding: 12, borderRadius: 12, fontSize: 12 }}>
            <strong>Hasil parsing: {parsed.length} soal valid</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {parsed.map((question, index) => <li key={index}><strong>[{question.type}]</strong> <AssessmentStemMarkdown content={question.stem} imageAsButton /> ({question.options.length} item{question.type === "MCQ" ? `, benar: opsi ${question.correctIndex! + 1}` : ""})</li>)}
            </ul>
          </div>
          <Toolbar><Btn type="submit" disabled={!parsed.length}>Buat asesmen · {parsed.length} soal</Btn></Toolbar>
        </form>
      </Panel>}

      {sel && analysis.data && <Panel style={{ marginBottom: 16 }}>
        <h3 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Analisis Butir ({analysis.data.attempts} terkumpul)</h3>
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 14 }}>
          {analysis.data.items.map((item) => <li key={item.questionId}>{item.stem} — n={item.n}, tingkat kesulitan={Math.round(item.difficulty * 100)}%</li>)}
        </ul>
        {diag.data && <p style={{ fontSize: 12, color: "#67685f" }}>Ringkasan diagnostik: {diag.data.n} siswa · rata-rata {diag.data.avg}</p>}
      </Panel>}
    </>
  );
}
