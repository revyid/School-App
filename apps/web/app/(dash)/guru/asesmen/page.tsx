"use client";

// Guru: daftar asesmen + buat baru (dari bank / inline) + analisis + diagnostik.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";

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
  const [stem, setStem] = useState("");
  const [options, setOptions] = useState("A\nB\nC\nD");
  const [correct, setCorrect] = useState(0);
  const opsiList = options.split("\n").map((s) => s.trim()).filter(Boolean);
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
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await api("/api/assessments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, title, kind,
        inline: [{ type: "MCQ", stem, options: opsiList, correctIndex: correct }],
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
    <>
      <PageHead kicker="Ujian" title="Asesmen kelas" desc="Buat ujian baru, lalu lihat analisis butir soal dan sebaran nilai." />
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Buat baru (1 soal MCQ inline)</h2>
        <form onSubmit={buat} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Kelas:
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">— pilih kelas —</option>
              {kelasUnik.map((r) => (
                <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
              ))}
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Judul:
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Jenis:
            <TextSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="REGULAR">REGULAR</option>
              <option value="DIAGNOSTIC">DIAGNOSTIC</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Soal:
            <textarea value={stem} onChange={(e) => setStem(e.target.value)} required rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Opsi (1 baris = 1 opsi):
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={4} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            <span>Jawaban benar:</span>
            {opsiList.length === 0 && <span style={{ fontSize: 12 }}>Isi opsi dulu di atas.</span>}
            {opsiList.map((o, i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "#171716" }}>
                <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                Opsi {i + 1}{o ? `: ${o.slice(0, 60)}` : ""}
              </label>
            ))}
          </div>
          <Toolbar><Btn type="submit">Buat asesmen</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Daftar</h2>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada asesmen. Buat yang pertama di atas.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Judul", "Jenis", "Soal", "Attempt", ""]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.title}</td>
                <td style={warmCell()}><Badge status={r.kind === "DIAGNOSTIC" ? "IZIN" : "AKTIF"}>{r.kind}</Badge></td>
                <td style={warmCell()}>{r._count?.questions ?? "?"}</td>
                <td style={warmCell()}>{r._count?.attempts ?? "?"}</td>
                <td style={warmCell()}><Btn kind="ghost" type="button" onClick={() => setSel(r.id)}>Analisis</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      {sel && analysis.data && (
        <Panel style={{ marginBottom: 16 }}>
          <h3 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Analisis butir ({analysis.data.attempts} terkumpul)</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 14 }}>
            {analysis.data.items.map((it) => (
              <li key={it.questionId}>
                {it.stem} — n={it.n}, sulit={Math.round(it.difficulty * 100)}%,
                distraktor: {Object.entries(it.distractors).map(([k, v]) => `${k}:${v}`).join(" ")}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {sel && diag.data && (
        <Panel>
          <h3 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Distribusi skor (n={diag.data.n}, rata-rata={diag.data.avg})</h3>
          <pre style={{ margin: 0, fontSize: 13, overflowX: "auto" }}>{diag.data.buckets.map((b, i) => `${i * 10}-${i * 10 + 10}: ${"#".repeat(b)} (${b})`).join("\n")}</pre>
        </Panel>
      )}
    </>
  );
}
