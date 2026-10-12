"use client";

// Guru: buat asesmen (teks massal + bank soal bergambar/video) + daftar + analisis/chart + histori murid + toggle + cetak PDF.
import { useState } from "react";
import AssessChart from "@/components/AssessChart";
import AssessmentStemMarkdown from "@/components/AssessmentStemMarkdown";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import { parseMultiQuestions, PLACEHOLDER_EXAMPLE } from "@/lib/parse-questions";

interface Row {
  id: string; title: string; showChart: boolean;
  _count?: { questions: number; attempts: number };
}

interface BankRow {
  id: string; type: string; stem: string; imageName: string | null; videoName: string | null; options: string[];
}

interface AnalysisItem { questionId: string; stem: string; n: number; difficulty: number; distractors: Record<string, number> }
interface HistRow { id: string; studentName: string; score: number | null; maxScore: number | null; correct: number; total: number; submittedAt: string | null }

function ChartBox({ items }: { items: AnalysisItem[] }) {
  return (
    <div style={{ maxWidth: 720, marginTop: 12 }}>
      <AssessChart
        labels={items.map((it, i) => `Soal ${i + 1}`)}
        pcts={items.map((it) => Math.round(it.difficulty * 100))}
        counts={items.map((it) => it.n)}
      />
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12.5, color: "#575752" }}>
        {items.map((it, i) => (
          <li key={it.questionId}>Soal {i + 1}. {it.stem.slice(0, 80)} — {Math.round(it.difficulty * 100)}% benar (n={it.n})</li>
        ))}
      </ul>
    </div>
  );
}

export default function AsesmenGuruPage() {
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>("/api/assessments");
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [showChart, setShowChart] = useState(true);
  const [rawText, setRawText] = useState(PLACEHOLDER_EXAMPLE);
  const [sel, setSel] = useState<string | null>(null);
  const analysis = useFetch<{ items: AnalysisItem[]; attempts: number }>(
    sel ? `/api/assessments/${sel}/analysis` : null,
  );
  const hist = useFetch<{ assessment: { title: string }; rows: HistRow[] }>(
    sel ? `/api/assessments/${sel}/attempts` : null,
  );
  const detail = useFetch<{ assessment: Row }>(sel ? `/api/assessments/${sel}` : null);
  const [msg, setMsg] = useState<string | null>(null);
  // Bank soal: pilih dari bank + tambah soal baru bergambar/video.
  const bank = useFetch<{ rows: BankRow[] }>("/api/questions");
  const [picked, setPicked] = useState<string[]>([]);
  const [bStem, setBStem] = useState("");
  const [bType, setBType] = useState("MCQ");
  const [bOpts, setBOpts] = useState("a \nb \nc ");
  const [bCorrect, setBCorrect] = useState("0");
  const [bImg, setBImg] = useState<File | null>(null);
  const [bVid, setBVid] = useState<File | null>(null);

  function togglePick(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function tambahBank(e: React.FormEvent) {
    e.preventDefault();
    const opts = bOpts.split("\n").map((s) => s.replace(/^[a-hA-H\d][.)\-:]?\s+/, "").trim()).filter(Boolean);
    if (!bStem.trim() || opts.length < 2) { setMsg("Isi batang soal + minimal 2 opsi"); return; }
    const form = new FormData();
    form.append("type", bType);
    form.append("stem", bStem);
    form.append("options", JSON.stringify(opts));
    form.append("correctIndex", bType === "MCQ" ? bCorrect : "");
    if (bImg) form.append("image", bImg);
    if (bVid) form.append("video", bVid);
    const res = await api("/api/questions", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Soal masuk bank");
      setBStem(""); setBOpts("a \nb \nc "); setBImg(null); setBVid(null);
      bank.reload();
    }
  }

  const { questions: parsed, errors: parseErrors } = parseMultiQuestions(rawText);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) { setMsg("Pilih kelas dulu"); return; }
    if (parsed.length === 0 && picked.length === 0) { setMsg("Pilih soal bank atau tulis soal massal."); return; }
    const res = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, title,
        showChart,
        shuffleQ: true, shuffleOpt: true,
        questionIds: picked,
        inline: parsed.map((q) => ({
          type: q.type, stem: q.stem, options: q.options,
          correctIndex: q.type === "MCQ" ? q.correctIndex : null,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else { setMsg(`Asesmen "${title}" berhasil dibuat dengan ${parsed.length + picked.length} soal!`); setTitle(""); setPicked([]); reload(); }
  }

  async function toggle(id: string, patch: { showChart?: boolean }) {
    const res = await api(`/api/assessments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else { reload(); detail.reload(); }
  }

  const selRow = data?.rows.find((r) => r.id === sel) ?? null;
  const chartOn = detail.data?.assessment.showChart ?? selRow?.showChart ?? true;

  return (
    <>
      <PageHead kicker="Ujian" title="Asesmen kelas" desc="Buat ujian dengan banyak soal sekaligus: pilihan ganda dan mengurutkan." />
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Buat Asesmen Baru</h2>
        <form onSubmit={buat} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Kelas:
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">— pilih kelas —</option>
              {kelasUnik.map((r) => (
                <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
              ))}
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Judul Asesmen / Ujian:
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="misal: Ulangan Harian Bab 1" required />
          </label>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={showChart} onChange={(e) => setShowChart(e.target.checked)} style={{ width: 18, height: 18 }} />
              Tampilkan chart ke murid
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Format Soal Massal (Bisa buat 1 atau banyak soal sekaligus):
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "12px 14px", fontSize: 13, fontFamily: "var(--font-mono, monospace)" }}
            />
            <span style={{ fontSize: 11, color: "#8a8a82" }}>
              Tulis (BENAR) di akhir opsi yang benar. Tipe: (SORTING) mengurutkan, (BENAR/SALAH), (ISIAN: jawaban).
              Hanya ISI opsi yang diacak ke siswa.
            </span>
          </label>
          <div style={{ background: "#fffdf8", border: "1px solid rgba(23,23,22,.14)", padding: 12, borderRadius: 12, fontSize: 12 }}>
            <strong>Pratinjau ketikan (chip, bukan tombol):</strong>
            <div style={{ marginTop: 6 }}>
              <AssessmentStemMarkdown content={rawText} imageAsButton />
            </div>
          </div>

          <div style={{ background: "#f0ede3", padding: 12, borderRadius: 12, fontSize: 12 }}>
            <strong>Hasil Parsing: {parsed.length} Soal Terdeteksi</strong>
            {parseErrors.length > 0 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#c94b35" }}>
                {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {parsed.map((q, idx) => (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <strong>[{q.rawType}]</strong> {q.stem.split("\n")[0]}
                  {" "}— {q.options.length} opsi
                  {q.type === "MCQ" && q.correctIndex != null && (
                    <>{`, benar: ${q.options[q.correctIndex]}`}</>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <Toolbar><Btn type="submit" disabled={parsed.length === 0 && picked.length === 0}>Buat {parsed.length + picked.length} Soal</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700, marginTop: 12, color: msg.includes("berhasil") ? "#50643e" : "#e85e43" }}>{msg}</p>}
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Bank soal ({picked.length} dipilih)</h2>
        {bank.loading && <Note>Memuat…</Note>}
        {bank.error && <Err>Gagal: {bank.error}</Err>}
        {bank.data && (bank.data.rows ?? []).length === 0 && <Note>Bank masih kosong. Tambah soal pertama di bawah.</Note>}
        {(bank.data?.rows ?? []).slice(0, 30).map((b) => (
          <label key={b.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", borderRadius: 12, border: "1px solid rgba(23,23,22,.14)", cursor: "pointer", marginBottom: 6, background: picked.includes(b.id) ? "#eeeadd" : "#fffdf8" }}>
            <input type="checkbox" checked={picked.includes(b.id)} onChange={() => togglePick(b.id)} style={{ width: 18, height: 18, marginTop: 2 }} />
            <span style={{ fontSize: 13 }}>
              <AssessmentStemMarkdown content={b.stem} />
              {b.imageName && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/assess-files/${b.id}/${b.imageName}`} alt="gambar soal" loading="lazy" style={{ display: "block", maxWidth: 320, borderRadius: 12, margin: "8px 0" }} />
              )}
              {b.videoName && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={`/api/assess-files/${b.id}/${b.videoName}`} controls preload="metadata" style={{ display: "block", maxWidth: 320, borderRadius: 12, margin: "8px 0" }} />
              )}
              <span style={{ color: "#8a8a82" }}> [{b.type}] {b.options.length} opsi</span>
            </span>
          </label>
        ))}
        <h3 className="display" style={{ fontSize: 15, margin: "16px 0 10px" }}>Tambah soal ke bank (gambar + video mp4/webm)</h3>
        <form onSubmit={tambahBank} style={{ display: "grid", gap: 12, maxWidth: 640 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Tipe:
            <TextSelect value={bType} onChange={(e) => setBType(e.target.value)}>
              <option value="MCQ">Pilihan ganda</option>
              <option value="SORTING">Mengurutkan</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Batang soal:
            <textarea value={bStem} onChange={(e) => setBStem(e.target.value)} required rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Opsi (satu per baris):
            <textarea value={bOpts} onChange={(e) => setBOpts(e.target.value)} required rows={4} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14, fontFamily: "var(--font-mono, monospace)" }} />
          </label>
          {bType === "MCQ" && (
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
              Index jawaban benar (0 = opsi pertama):
              <TextInput value={bCorrect} onChange={(e) => setBCorrect(e.target.value)} inputMode="numeric" />
            </label>
          )}
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Gambar (JPEG/PNG, maks 5MB, opsional):
            <input type="file" accept="image/jpeg,image/png" onChange={(e) => setBImg(e.target.files?.[0] ?? null)} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Video (MP4/WebM, maks 20MB, opsional):
            <input type="file" accept="video/mp4,video/webm" onChange={(e) => setBVid(e.target.files?.[0] ?? null)} />
          </label>
          <Toolbar><Btn type="submit">Simpan ke bank</Btn></Toolbar>
        </form>
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Daftar Asesmen</h2>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada asesmen. Buat yang pertama di atas.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Judul", "Soal", "Mengerjakan", "Chart", "Aksi"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.title}</td>
                <td style={warmCell()}>{r._count?.questions ?? "?"} soal</td>
                <td style={warmCell()}>{r._count?.attempts ?? "?"} siswa</td>
                <td style={warmCell()}>
                  <button type="button" onClick={() => toggle(r.id, { showChart: !r.showChart })}
                    style={{ border: "1px solid rgba(23,23,22,.3)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: r.showChart ? "#50643e" : "#fffdf8", color: r.showChart ? "#fff" : "#171716" }}>
                    {r.showChart ? "Aktif" : "Mati"}
                  </button>
                </td>
                <td style={warmCell()}><Btn kind="ghost" type="button" onClick={() => setSel(r.id)}>Analisis</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>

      {sel && (
        <Panel style={{ marginBottom: 16 }}>
          <Toolbar>
            <h3 className="display" style={{ fontSize: 18, margin: 0, flex: 1 }}>
              Analisis: {selRow?.title ?? ""} {analysis.data ? `(${analysis.data.attempts} terkumpul)` : ""}
            </h3>
            <Btn kind="ghost" type="button" onClick={() => setSel(null)}>Tutup</Btn>
            <Btn kind="dark" type="button" onClick={() => window.print()}>Cetak PDF</Btn>
          </Toolbar>
          {analysis.data && analysis.data.items.length > 0 && chartOn && <ChartBox items={analysis.data.items} />}
          {analysis.data && analysis.data.items.length > 0 && !chartOn && (
            <Note>Chart dimatikan untuk asesmen ini (toggle Chart di atas). Murid tidak melihat chart.</Note>
          )}
          {analysis.data && analysis.data.items.length === 0 && <Note>Belum ada jawaban terkumpul.</Note>}
          {hist.data && hist.data.rows.length > 0 && (
            <>
              <h4 className="display" style={{ fontSize: 15, margin: "16px 0 8px" }}>Histori murid (read-only)</h4>
              <WarmTable head={["Nama", "Skor", "Benar", "Status"]}>
                {hist.data.rows.map((h) => (
                  <tr key={h.id}>
                    <td style={warmCell({ fontWeight: 700 })}>{h.studentName}</td>
                    <td style={warmCell()}>{h.score ?? "—"}/{h.maxScore ?? "—"}</td>
                    <td style={warmCell()}>{h.correct}/{h.total}</td>
                    <td style={warmCell()}><Badge status={h.submittedAt ? "AKTIF" : "PENDING"}>{h.submittedAt ? "Terkumpul" : "Mengerjakan"}</Badge></td>
                  </tr>
                ))}
              </WarmTable>
            </>
          )}
        </Panel>
      )}
    </>
  );
}
