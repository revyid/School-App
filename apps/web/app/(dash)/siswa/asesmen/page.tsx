"use client";

// Siswa: daftar asesmen + kerjakan (MCQ pilih opsi; SORTING: naik/turunkan urutan).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

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

  function move(qid: string, opts: string[], from: number, dir: -1 | 1) {
    const cur = sort[qid] ?? opts;
    const to = from + dir;
    if (to < 0 || to >= cur.length) return;
    const next = [...cur];
    [next[from], next[to]] = [next[to], next[from]];
    setSort({ ...sort, [qid]: next });
  }

  async function kumpul() {
    if (!aid || !attempt.data) return;
    // Petakan jawaban SORTING (teks) kembali ke indeks koordinat acak.
    const answers = attempt.data.questions.map((q) => {
      if (q.type === "MCQ") return { questionId: q.id, pickedIndex: mcq[q.id] ?? null };
      const cur = sort[q.id] ?? q.options;
      return { questionId: q.id, pickedOrder: cur.map((t) => q.options.indexOf(t)) };
    });
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
  }

  return (
    <main>
      <h1>Asesmen</h1>
      {loading && <p>Memuat…</p>}
      {data && !aid && (
        <ul>
          {data.rows.map((r) => (
            <li key={r.id}>
              {r.title} {r.deadline ? `(deadline ${r.deadline.slice(0, 10)})` : ""}{" "}
              <button type="button" onClick={() => setAid(r.id)}>Kerjakan</button>
            </li>
          ))}
        </ul>
      )}
      {aid && attempt.data && (
        <div>
          <h2>{attempt.data.assessment.title}</h2>
          {attempt.data.attempt.submittedAt ? (
            <p>Sudah dikumpulkan{attempt.data.attempt.score != null ? `, skor: ${attempt.data.attempt.score}` : ""}.</p>
          ) : (
            <>
              {attempt.data.questions.map((q, qi) => (
                <div key={q.id}>
                  <p>{qi + 1}. {q.stem}</p>
                  {q.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imageUrl} alt="gambar soal" style={{ maxWidth: 480 }} />
                  )}
                  {q.type === "MCQ" ? (
                    <ul>
                      {q.options.map((o, i) => (
                        <li key={i}>
                          <label>
                            <input
                              type="radio" name={q.id} checked={mcq[q.id] === i}
                              onChange={() => setMcq({ ...mcq, [q.id]: i })}
                            /> {o}
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ol>
                      {(sort[q.id] ?? q.options).map((o, i, arr) => (
                        <li key={`${o}-${i}`}>
                          {o}{" "}
                          <button type="button" onClick={() => move(q.id, q.options, i, -1)}>↑</button>
                          <button type="button" onClick={() => move(q.id, q.options, i, 1)}>↓</button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
              <button type="button" onClick={kumpul}>Kumpulkan jawaban</button>
            </>
          )}
          <button type="button" onClick={() => { setAid(null); setMsg(null); }}>Kembali</button>
        </div>
      )}
      {msg && <p>{msg}</p>}
    </main>
  );
}
