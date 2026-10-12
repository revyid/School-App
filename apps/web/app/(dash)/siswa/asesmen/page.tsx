"use client";

// Siswa: daftar asesmen + kerjakan + review read-only (hijau benar, tanpa label A/B/C) + chart + cetak PDF.
import { useState } from "react";
import AssessChart from "@/components/AssessChart";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, Btn, Note } from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Glyph } from "../../../../components/Glyph";

interface Q {
  id: string; type: "MCQ" | "SORTING"; stem: string; imageUrl: string | null; videoUrl: string | null; options: string[];
}
interface RQSort { id: string; type: "SORTING"; stem: string; imageUrl: string | null; videoUrl: string | null; correctSeq: string[]; pickedSeq: string[]; isCorrect: boolean; points: number; maxPoints: number }
interface RQMcq { id: string; type: "MCQ"; stem: string; imageUrl: string | null; videoUrl: string | null; options: string[]; pickedIndex: number | null; correctIndex: number | null; isCorrect: boolean; points: number; maxPoints: number }
type RQ = RQSort | RQMcq;
interface Result {
  submitted: boolean;
  attempt?: { id: string; score: number | null; maxScore: number | null; submittedAt: string };
  assessment?: { id: string; title: string; showChart: boolean };
  questions?: RQ[];
  stats?: { questionId: string; pct: number; n: number }[];
}

export default function AsesmenSiswaPage() {
  const { data, loading, reload } = useFetch<{ rows: { id: string; title: string; deadline: string | null; showChart: boolean }[] }>("/api/assessments");
  const [aid, setAid] = useState<string | null>(null);
  const attempt = useFetch<{ attempt: { id: string; submittedAt: string | null; score?: number }; assessment: { title: string; showChart: boolean }; questions: Q[] }>(
    aid ? `/api/assessments/${aid}/attempt` : null,
  );
  const result = useFetch<Result>(
    aid && attempt.data?.attempt.submittedAt ? `/api/assessments/${aid}/result` : null,
  );
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmKumpul, setConfirmKumpul] = useState(false);

  function move(qid: string, opts: string[], from: number, dir: -1 | 1) {
    const cur = sort[qid] ?? opts;
    const to = from + dir;
    if (to < 0 || to >= cur.length) return;
    const next = [...cur];
    [next[from], next[to]] = [next[to], next[from]];
    setSort({ ...sort, [qid]: next });
  }

  function kumpul() {
    if (!aid || !attempt.data || submitting) return;
    setConfirmKumpul(true);
  }

  function kumpulMsg(): string {
    if (!aid || !attempt.data) return "Kumpulkan jawaban? Setelah dikumpulkan tidak bisa diubah.";
    const total = attempt.data.questions.length;
    const dijawab = attempt.data.questions.filter((q) =>
      q.type === "MCQ" ? mcq[q.id] != null : true,
    ).length;
    const kosong = total - dijawab;
    return kosong > 0
      ? `Kamu menjawab ${dijawab} dari ${total} soal (${kosong} kosong). Tetap kumpulkan?`
      : `Kumpulkan ${total} jawaban? Setelah dikumpulkan tidak bisa diubah.`;
  }

  async function doKumpul() {
    if (!aid || !attempt.data || submitting) return;
    setConfirmKumpul(false);
    setSubmitting(true);
    const answers = attempt.data.questions.map((q) => {
      if (q.type === "MCQ") return { questionId: q.id, pickedIndex: mcq[q.id] ?? null };
      const cur = sort[q.id] ?? q.options;
      return { questionId: q.id, pickedOrder: cur.map((t) => q.options.indexOf(t)) };
    });
    try {
      const res = await api(`/api/assessments/${aid}/attempt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
      else {
        setMsg(`Terkumpul! Skor: ${d.score}/${d.maxScore}`);
        attempt.reload();
        reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showChart = result.data?.assessment?.showChart ?? attempt.data?.assessment.showChart ?? false;

  return (
    <>
      <PageHead kicker="Ujian" title="Asesmen" desc="Kerjakan dengan jujur. Soal diacak per siswa, nilai keluar otomatis." />
      {loading && <Note>Memuat…</Note>}
      {data && !aid && (
        <Panel>
          {data.rows.length === 0 && <Note>Belum ada asesmen untukmu.</Note>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {data.rows.map((r) => (
              <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 200, fontWeight: 700 }}>{r.title}</span>
                {r.deadline && <span style={{ fontSize: 12.5, color: "#74746d" }}>deadline {r.deadline.slice(0, 10)}</span>}
                <Btn type="button" kind="dark" onClick={() => setAid(r.id)}>Kerjakan</Btn>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {aid && attempt.data && (
        <Panel>
          <Toolbar>
            <h2 className="display" style={{ fontSize: 20, margin: 0, flex: 1 }}>{attempt.data.assessment.title}</h2>
            {attempt.data.attempt.submittedAt && <Btn kind="dark" type="button" onClick={() => window.print()}>Cetak PDF</Btn>}
          </Toolbar>
          {attempt.data.attempt.submittedAt ? (
            <>
              <Note>Sudah dikumpulkan{attempt.data.attempt.score != null ? `, skor: ${attempt.data.attempt.score}` : ""}. Hasil di bawah read-only, tidak bisa diubah.</Note>
              {result.data?.submitted && (
                <>
                  {result.data.questions?.map((q, qi) => (
                    <div key={q.id} style={{ marginBottom: 18, padding: 14, border: "1px solid rgba(23,23,22,.14)", borderRadius: 16, background: q.isCorrect ? "#f2f7ec" : "#fffdf8" }}>
                      <p style={{ fontWeight: 700, margin: "0 0 10px" }}>{qi + 1}. {q.stem}</p>
                      {q.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.imageUrl} alt="gambar soal" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 10 }} />
                      )}
                      {q.videoUrl && (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={q.videoUrl} controls preload="metadata" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 10 }} />
                      )}
                      {q.type === "MCQ" ? (
                        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                          {q.options.map((o, i) => {
                            const benar = i === q.correctIndex;
                            const dipilih = i === q.pickedIndex;
                            return (
                              <li key={i} style={{
                                padding: "9px 12px", borderRadius: 12,
                                border: benar ? "2px solid #50643e" : "1px solid rgba(23,23,22,.14)",
                                background: benar ? "#dcead0" : dipilih ? "#f6e8e3" : "#fffdf8",
                                fontWeight: benar || dipilih ? 700 : 400,
                              }}>
                                <span>{o}</span>
                                {benar && <span style={{ marginLeft: 8, fontSize: 12, color: "#50643e" }}>✓ benar</span>}
                                {!benar && dipilih && <span style={{ marginLeft: 8, fontSize: 12, color: "#e85e43" }}>✗ jawabanmu</span>}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                          <div><strong>Urutan benar:</strong> {q.correctSeq.join(" → ")}</div>
                          <div><strong>Jawabanmu:</strong> {q.pickedSeq.join(" → ")}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {showChart && result.data.stats && result.data.stats.length > 0 && (
                    <div style={{ marginTop: 8, maxWidth: 720 }}>
                      <h3 className="display" style={{ fontSize: 16, margin: "0 0 8px" }}>Chart kelas: persentase benar per soal</h3>
                      <AssessChart
                        labels={result.data.stats.map((_, i) => `Soal ${i + 1}`)}
                        pcts={result.data.stats.map((s) => s.pct)}
                        counts={result.data.stats.map((s) => s.n)}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {attempt.data.questions.map((q, qi) => (
                <div key={q.id} style={{ marginBottom: 18, padding: 14, border: "1px solid rgba(23,23,22,.14)", borderRadius: 16 }}>
                  <p style={{ fontWeight: 700, margin: "0 0 10px" }}>{qi + 1}. {q.stem}</p>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="gambar soal" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 10 }} />
                  )}
                  {q.videoUrl && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={q.videoUrl} controls preload="metadata" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 10 }} />
                  )}
                  {q.type === "MCQ" ? (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                      {q.options.map((o, i) => (
                        <li key={i}>
                          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px", borderRadius: 12, border: "1px solid rgba(23,23,22,.14)", cursor: "pointer", background: mcq[q.id] === i ? "#eeeadd" : "#fffdf8" }}>
                            <input
                              type="radio" name={q.id} checked={mcq[q.id] === i}
                              onChange={() => setMcq({ ...mcq, [q.id]: i })}
                            /> <span>{o}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                      {(sort[q.id] ?? q.options).map((o, i) => (
                        <li key={`${o}-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ flex: 1 }}>{o}{" "}</span>
                          <Btn type="button" kind="ghost" onClick={() => move(q.id, q.options, i, -1)}><Glyph name="arrowUp" size={14} /></Btn>
                          <Btn type="button" kind="ghost" onClick={() => move(q.id, q.options, i, 1)}><Glyph name="arrowDown" size={14} /></Btn>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              <Toolbar>
                <Btn type="button" onClick={kumpul} disabled={submitting}>{submitting ? "Mengumpulkan…" : "Kumpulkan jawaban"}</Btn>
              </Toolbar>
            </>
          )}
          <Toolbar>
            <Btn type="button" kind="ghost" onClick={() => { setAid(null); setMsg(null); }}>Kembali</Btn>
          </Toolbar>
        </Panel>
      )}
      {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      <ConfirmDialog
        open={confirmKumpul}
        title="Kumpulkan Jawaban"
        message={kumpulMsg()}
        confirmLabel="Kumpulkan"
        onConfirm={doKumpul}
        onCancel={() => setConfirmKumpul(false)}
      />
    </>
  );
}
