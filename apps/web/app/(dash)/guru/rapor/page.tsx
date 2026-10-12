"use client";

// Rapor: tabel nilai + histori pengumpulan tugas dan asesmen per siswa.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextSelect, WarmTable, warmCell, Note, Err, LinkBtn } from "@/components/DashUI";

type TaskHistory = {
  taskId: string; title: string; state: string; deadline: string | null;
  submittedAt: string | null; isLate: boolean; score: number | null;
  feedback: string | null; gradedAt: string | null;
};
type AssessmentHistory = {
  assessmentId: string; title: string; state: string; attemptId: string | null;
  startedAt: string | null; submittedAt: string | null; score: number | null;
  maxScore: number | null; feedback: string | null; gradedAt: string | null;
};

export default function RaporPage() {
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { score: string; feedback: string }>>({});
  const [gradeStatus, setGradeStatus] = useState<Record<string, string>>({});
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const gb = useFetch<{
    tasks: { id: string; title: string; deadline: string | null }[];
    assessments: { id: string; title: string; deadline: string | null }[];
    rows: {
      studentId: string; name: string; taskScores: Record<string, number | null>;
      assessScores: Record<string, number | null>; taskHistory: TaskHistory[];
      assessmentHistory: AssessmentHistory[]; avg: number | null;
    }[];
  }>(classId ? `/api/gradebook?classId=${encodeURIComponent(classId)}` : null);

  async function saveAssessmentGrade(item: AssessmentHistory) {
    if (!item.attemptId) return;
    const draft = gradeDrafts[item.attemptId] ?? { score: String(item.score ?? ""), feedback: item.feedback ?? "" };
    if (draft.score.trim() === "") {
      setGradeStatus((prev) => ({ ...prev, [item.attemptId!]: "Masukkan nilai terlebih dahulu." }));
      return;
    }
    setGradeStatus((prev) => ({ ...prev, [item.attemptId!]: "Menyimpan…" }));
    try {
      const response = await api(`/api/assessments/${item.assessmentId}/grade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId: item.attemptId, score: Number(draft.score), feedback: draft.feedback || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Gagal (${response.status})`);
      setGradeStatus((prev) => ({ ...prev, [item.attemptId!]: "Nilai tersimpan." }));
      gb.reload();
    } catch (cause) {
      setGradeStatus((prev) => ({ ...prev, [item.attemptId!]: cause instanceof Error ? cause.message : "Gagal menyimpan nilai." }));
    }
  }

  return (
    <>
      <PageHead
        kicker="Nilai"
        title="Rapor kelas"
        desc="Nilai tugas dan asesmen, serta histori pengumpulan setiap siswa. Guru dapat memperbarui nilai asesmen dari detail histori."
        right={classId ? (
          <span style={{ display: "flex", gap: 8 }}>
            <LinkBtn kind="ghost" href="#" onClick={(e) => { e.preventDefault(); window.print(); }}>Cetak / PDF</LinkBtn>
            <LinkBtn kind="dark" href={`/api/gradebook/export?classId=${encodeURIComponent(classId)}`} target="_blank" rel="noreferrer">Ekspor .xlsx</LinkBtn>
          </span>
        ) : undefined}
      />
      <Panel>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Kelas:
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">— pilih kelas —</option>
              {kelasUnik.map((r) => <option key={r.class.id} value={r.class.id}>{r.class.name}</option>)}
            </TextSelect>
          </label>
        </Toolbar>
        {gb.loading && <Note>Memuat…</Note>}
        {gb.error && <Err>Gagal: {gb.error}</Err>}
        {gb.data && gb.data.rows.length === 0 && <Note>Belum ada siswa/nilai di kelas ini.</Note>}
        {gb.data && gb.data.rows.length > 0 && (
          <WarmTable head={["Nama / histori", ...gb.data.tasks.map((t) => t.title), ...gb.data.assessments.map((x) => x.title), "Rata-rata"]}>
            {gb.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td style={warmCell({ fontWeight: 700, position: "sticky", left: 0, background: "#fffdf8", zIndex: 1, minWidth: 210 })}>
                  {r.name}
                  <details style={{ marginTop: 5, fontWeight: 400 }}>
                    <summary style={{ cursor: "pointer", color: "#426047", fontSize: 11 }}>Lihat histori tugas & asesmen</summary>
                    <div style={{ display: "grid", gap: 12, padding: "10px 2px", minWidth: 300, maxWidth: 520, whiteSpace: "normal" }}>
                      <section>
                        <strong style={{ fontSize: 12 }}>Tugas</strong>
                        {r.taskHistory.length === 0 ? <p style={{ margin: "4px 0", fontSize: 12, color: "#777" }}>Belum ada tugas.</p> : r.taskHistory.map((item) => (
                          <div key={item.taskId} style={{ borderTop: "1px solid #e5e3d9", padding: "6px 0", fontSize: 11 }}>
                            <b>{item.title}</b> · {item.state}
                            <div style={{ color: "#6f7067" }}>
                              Tenggat: {item.deadline ? new Date(item.deadline).toLocaleString("id-ID") : "-"}
                              {item.submittedAt && <> · Dikumpulkan: {new Date(item.submittedAt).toLocaleString("id-ID")}</>}
                              {item.score != null && <> · Nilai: <b>{item.score}</b></>}
                            </div>
                            {item.feedback && <div>Umpan balik: {item.feedback}</div>}
                          </div>
                        ))}
                      </section>
                      <section>
                        <strong style={{ fontSize: 12 }}>Asesmen</strong>
                        {r.assessmentHistory.length === 0 ? <p style={{ margin: "4px 0", fontSize: 12, color: "#777" }}>Belum ada asesmen.</p> : r.assessmentHistory.map((item) => (
                          <div key={item.assessmentId} style={{ borderTop: "1px solid #e5e3d9", padding: "7px 0", fontSize: 11 }}>
                            <b>{item.title}</b> · {item.state}
                            <div style={{ color: "#6f7067" }}>
                              Tenggat: {gb.data!.assessments.find((a) => a.id === item.assessmentId)?.deadline ? new Date(gb.data!.assessments.find((a) => a.id === item.assessmentId)!.deadline!).toLocaleString("id-ID") : "-"}
                              {item.startedAt && <> · Mulai: {new Date(item.startedAt).toLocaleString("id-ID")}</>}
                              {item.submittedAt && <> · Dikumpulkan: {new Date(item.submittedAt).toLocaleString("id-ID")}</>}
                              {item.score != null && <> · Nilai: <b>{item.score}/{item.maxScore}</b></>}
                            </div>
                            {item.submittedAt && item.attemptId && (
                              <div style={{ display: "grid", gridTemplateColumns: "80px minmax(100px,1fr) auto", gap: 5, marginTop: 6, alignItems: "center" }}>
                                <input
                                  type="number" min={0} max={item.maxScore ?? undefined}
                                  aria-label={`Nilai asesmen ${item.title}`}
                                  placeholder={String(item.score ?? 0)}
                                  value={gradeDrafts[item.attemptId]?.score ?? String(item.score ?? "")}
                                  onChange={(event) => setGradeDrafts((prev) => ({ ...prev, [item.attemptId!]: { score: event.target.value, feedback: prev[item.attemptId!]?.feedback ?? item.feedback ?? "" } }))}
                                  style={{ width: "100%", padding: "6px 7px", border: "1px solid #d5d4c9", borderRadius: 8, fontSize: 11 }}
                                />
                                <input
                                  type="text" maxLength={2000} aria-label={`Umpan balik asesmen ${item.title}`}
                                  placeholder="Umpan balik opsional"
                                  value={gradeDrafts[item.attemptId]?.feedback ?? item.feedback ?? ""}
                                  onChange={(event) => setGradeDrafts((prev) => ({ ...prev, [item.attemptId!]: { score: prev[item.attemptId!]?.score ?? String(item.score ?? ""), feedback: event.target.value } }))}
                                  style={{ width: "100%", padding: "6px 7px", border: "1px solid #d5d4c9", borderRadius: 8, fontSize: 11 }}
                                />
                                <button type="button" onClick={() => void saveAssessmentGrade(item)} style={{ padding: "6px 8px", border: 0, borderRadius: 8, background: "#22251f", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Simpan</button>
                              </div>
                            )}
                            {item.attemptId && gradeStatus[item.attemptId] && <div role="status" style={{ marginTop: 4, color: gradeStatus[item.attemptId].includes("Gagal") || gradeStatus[item.attemptId].includes("Masukkan") ? "#a33" : "#426047" }}>{gradeStatus[item.attemptId]}</div>}
                            {item.gradedAt && <div style={{ marginTop: 3, color: "#777" }}>Nilai diperbarui: {new Date(item.gradedAt).toLocaleString("id-ID")}</div>}
                            {item.feedback && !item.attemptId && <div>Umpan balik: {item.feedback}</div>}
                          </div>
                        ))}
                      </section>
                    </div>
                  </details>
                </td>
                {gb.data!.tasks.map((t) => <td key={t.id} style={warmCell()}>{r.taskScores[t.id] ?? "-"}</td>)}
                {gb.data!.assessments.map((x) => <td key={x.id} style={warmCell()}>{r.assessScores[x.id] ?? "-"}</td>)}
                <td style={warmCell({ fontWeight: 800 })}>{r.avg ?? "-"}</td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
