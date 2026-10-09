"use client";

// Siswa: daftar asesmen + kerjakan (MCQ pilih opsi; SORTING: naik/turunkan urutan).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, Btn, Note } from "@/components/DashUI";

interface Q {
  id: string; type: "MCQ" | "SORTING"; stem: string; imageUrl: string | null; options: string[];
}

export default function AsesmenSiswaPage() {
  const { data, loading, reload } = useFetch<{ rows: { id: string; title: string; deadline: string | null }[] }>("/api/assessments");
  const [aid, setAid] = useState<string | null>(null);
  const attempt = useFetch<{ attempt: { id: string; submittedAt: string | null; score?: number }; assessment: { title: string }; questions: Q[] }>(
    aid ? `/api/assessments/${aid}/attempt` : null,
  );
  const [mcq, setMcq] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<Record<string, string[]>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function move(qid: string, opts: string[], from: number, dir: -1 | 1) {
    const cur = sort[qid] ?? opts;
    const to = from + dir;
    if (to < 0 || to >= cur.length) return;
    const next = [...cur];
    [next[from], next[to]] = [next[to], next[from]];
    setSort({ ...sort, [qid]: next });
  }

  async function kumpul() {
    if (!aid || !attempt.data || submitting) return;
    const total = attempt.data.questions.length;
    const dijawab = attempt.data.questions.filter((q) =>
      q.type === "MCQ" ? mcq[q.id] != null : true,
    ).length;
    const kosong = total - dijawab;
    const yakin = window.confirm(
      kosong > 0
        ? `Kamu menjawab ${dijawab} dari ${total} soal (${kosong} kosong). Tetap kumpulkan?`
        : `Kumpulkan ${total} jawaban? Setelah dikumpulkan tidak bisa diubah.`,
    );
    if (!yakin) return;
    setSubmitting(true);
    // Petakan jawaban SORTING (teks) kembali ke indeks koordinat acak.
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
          <h2 className="display" style={{ fontSize: 20, margin: "0 0 14px" }}>{attempt.data.assessment.title}</h2>
          {attempt.data.attempt.submittedAt ? (
            <Note>Sudah dikumpulkan{attempt.data.attempt.score != null ? `, skor: ${attempt.data.attempt.score}` : ""}.</Note>
          ) : (
            <>
              {attempt.data.questions.map((q, qi) => (
                <div key={q.id} style={{ marginBottom: 18, padding: 14, border: "1px solid rgba(23,23,22,.14)", borderRadius: 16 }}>
                  <p style={{ fontWeight: 700, margin: "0 0 10px" }}>{qi + 1}. {q.stem}</p>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="gambar soal" style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 10 }} />
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
                      {(sort[q.id] ?? q.options).map((o, i, arr) => (
                        <li key={`${o}-${i}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ flex: 1 }}>{o}{" "}</span>
                          <Btn type="button" kind="ghost" onClick={() => move(q.id, q.options, i, -1)}>↑</Btn>
                          <Btn type="button" kind="ghost" onClick={() => move(q.id, q.options, i, 1)}>↓</Btn>
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
    </>
  );
}
