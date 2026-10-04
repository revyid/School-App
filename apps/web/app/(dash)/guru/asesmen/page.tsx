"use client";

// Guru: daftar asesmen + buat baru (dari bank / inline) + analisis + diagnostik.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface Row {
  id: string; kind: string; title: string;
  _count?: { questions: number; attempts: number };
}

export default function AsesmenGuruPage() {
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>("/api/assessments");
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("REGULAR");
  const [stem, setStem] = useState("");
  const [options, setOptions] = useState("A\nB\nC\nD");
  const [correct, setCorrect] = useState("1");
  const [sel, setSel] = useState<string | null>(null);
  const analysis = useFetch<{ items: { questionId: string; stem: string; n: number; difficulty: number; distractors: Record<string, number> }[]; attempts: number }>(
    sel ? `/api/assessments/${sel}/analysis` : null,
  );
  const diag = useFetch<{ n: number; avg: number; buckets: number[] }>(
    sel ? `/api/assessments/${sel}/diagnostic` : null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    const opts = options.split("\n").map((s) => s.trim()).filter(Boolean);
    const res = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, title, kind,
        inline: [{ type: "MCQ", stem, options: opts, correctIndex: Number(correct) }],
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Asesmen dibuat");
      setTitle("");
      setStem("");
      reload();
    }
  }

  return (
    <main>
      <h1>Asesmen</h1>
      <h2>Buat baru (1 soal MCQ inline)</h2>
      <form onSubmit={buat}>
        <label>ID kelas: <input value={classId} onChange={(e) => setClassId(e.target.value)} required placeholder="classId" /></label>
        <label>Judul: <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Jenis:
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="REGULAR">REGULAR</option>
            <option value="DIAGNOSTIC">DIAGNOSTIC</option>
          </select>
        </label>
        <label>Soal: <textarea value={stem} onChange={(e) => setStem(e.target.value)} required /></label>
        <label>Opsi (1 baris = 1 opsi): <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={4} /></label>
        <label>Index benar (0-based): <input value={correct} onChange={(e) => setCorrect(e.target.value)} required /></label>
        <button type="submit">Buat</button>
      </form>
      {msg && <p>{msg}</p>}
      <h2>Daftar</h2>
      {loading && <p>Memuat…</p>}
      {error && <p>Gagal: {error}</p>}
      {data && (
        <ul>
          {data.rows.map((r) => (
            <li key={r.id}>
              {r.title} · {r.kind} · {r._count?.questions ?? "?"} soal · {r._count?.attempts ?? "?"} attempt{" "}
              <button type="button" onClick={() => setSel(r.id)}>Analisis</button>
            </li>
          ))}
        </ul>
      )}
      {sel && analysis.data && (
        <div>
          <h3>Analisis butir ({analysis.data.attempts} terkumpul)</h3>
          <ul>
            {analysis.data.items.map((it) => (
              <li key={it.questionId}>
                {it.stem} — n={it.n}, sulit={Math.round(it.difficulty * 100)}%,
                distraktor: {Object.entries(it.distractors).map(([k, v]) => `${k}:${v}`).join(" ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sel && diag.data && (
        <div>
          <h3>Distribusi skor (n={diag.data.n}, rata-rata={diag.data.avg})</h3>
          <pre>{diag.data.buckets.map((b, i) => `${i * 10}-${i * 10 + 10}: ${"#".repeat(b)} (${b})`).join("\n")}</pre>
        </div>
      )}
    </main>
  );
}
