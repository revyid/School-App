"use client";

// Guru: daftar asesmen + buat baru (multi-soal via teks/preset) + analisis + diagnostik.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import { parseMultiQuestions, PLACEHOLDER_EXAMPLE, type ParsedQ } from "@/lib/parse-questions";

interface Row {
  id: string; kind: string; title: string;
  _count?: { questions: number; attempts: number };
}

export default function AsesmenGuruPage() {
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>("/api/assessments");
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("REGULAR");
  const [rawText, setRawText] = useState(PLACEHOLDER_EXAMPLE);
  const [sel, setSel] = useState<string | null>(null);
  const analysis = useFetch<{ items: { questionId: string; stem: string; n: number; difficulty: number; distractors: Record<string, number> }[]; attempts: number }>(
    sel ? `/api/assessments/${sel}/analysis` : null,
  );
  const diag = useFetch<{ n: number; avg: number; buckets: number[] }>(
    sel ? `/api/assessments/${sel}/diagnostic` : null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  const { questions: parsed, errors: parseErrors } = parseMultiQuestions(rawText);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    if (parsed.length === 0) {
      setMsg("Format soal belum terdeteksi. Gunakan contoh format di bawah.");
      return;
    }
    const res = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId,
        title,
        kind,
        shuffleQ: true,
        shuffleOpt: true,
        inline: parsed.map((q) => ({
          type: q.type,
          stem: q.stem,
          options: q.options,
          correctIndex: q.type === "MCQ" ? q.correctIndex : null,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Asesmen "${title}" berhasil dibuat dengan ${parsed.length} soal!`);
      setTitle("");
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Ujian" title="Asesmen kelas" desc="Buat ujian dengan banyak soal sekaligus: pilihan ganda, mengurutkan, benar/salah, dan isian." />
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
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Jenis Asesmen:
            <TextSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="REGULAR">REGULAR (Nilai biasa)</option>
              <option value="DIAGNOSTIC">DIAGNOSTIC (Asesmen awal)</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#575752" }}>
            Format Soal Massal (Bisa buat 1 atau banyak soal sekaligus):
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              required
              rows={12}
              style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "12px 14px", fontSize: 13, fontFamily: "var(--font-mono, monospace)" }}
            />
            <span style={{ fontSize: 11, color: "#8a8a82" }}>
              Tulis (BENAR) di akhir opsi yang benar. Tipe: (SORTING) mengurutkan, (BENAR/SALAH), (ISIAN: jawaban).
              Hanya ISI opsi yang diacak ke siswa — label a/b/c tetap berurutan.
            </span>
          </label>

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
                  {q.stem.split("\n").length > 1 && <span style={{ color: "#74746d" }}> (+{q.stem.split("\n").length - 1} baris)</span>}
                  {" "}— {q.options.length} opsi
                  {q.type === "MCQ" && q.correctIndex != null && (
                    <>{`, benar: ${String.fromCharCode(97 + q.correctIndex)}. ${q.options[q.correctIndex]}`}</>
                  )}
                  {q.type === "SORTING" && <> (urutan benar: a, b, c, …)</>}
                </li>
              ))}
            </ul>
          </div>

          <Toolbar><Btn type="submit" disabled={parsed.length === 0}>Buat {parsed.length} Soal</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700, marginTop: 12, color: msg.includes("berhasil") ? "#50643e" : "#e85e43" }}>{msg}</p>}
      </Panel>

      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Daftar Asesmen</h2>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada asesmen. Buat yang pertama di atas.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Judul", "Jenis", "Total Soal", "Siswa Mengerjakan", "Aksi"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.title}</td>
                <td style={warmCell()}><Badge status={r.kind === "DIAGNOSTIC" ? "IZIN" : "AKTIF"}>{r.kind}</Badge></td>
                <td style={warmCell()}>{r._count?.questions ?? "?"} soal</td>
                <td style={warmCell()}>{r._count?.attempts ?? "?"} siswa</td>
                <td style={warmCell()}><Btn kind="ghost" type="button" onClick={() => setSel(r.id)}>Analisis</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>

      {sel && analysis.data && (
        <Panel style={{ marginBottom: 16 }}>
          <h3 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Analisis Butir ({analysis.data.attempts} terkumpul)</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 14 }}>
            {analysis.data.items.map((it) => (
              <li key={it.questionId}>
                {it.stem} — n={it.n}, tingkat kesulitan={Math.round(it.difficulty * 100)}%
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
