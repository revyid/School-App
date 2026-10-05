"use client";

// Guru: detail tugas + progres + nilai + kirim pengingat/terima kasih (Phase 5 menyambung via notifikasi).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, WarmTable, warmCell, SegStat, Note, Err } from "@/components/DashUI";

interface Sub {
  id: string;
  studentId: string;
  text: string | null;
  link: string | null;
  fileName: string | null;
  submittedAt: string;
  isLate: boolean;
  score: number | null;
  feedback: string | null;
  student: { id: string; name: string; nisn: string | null };
}

export default function GuruTugasDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  useState(() => {
    void params.then((p) => setId(p.id));
  });
  const detail = useFetch<{
    task: { id: string; title: string; instruction: string; deadline: string | null; allowLate: boolean; class: { name: string } };
    visible: boolean;
    submissions: Sub[];
    pending: { id: string; name: string }[];
  }>(id ? `/api/tasks/${id}` : null);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function nilai(subId: string) {
    const g = grades[subId];
    if (!g?.score) return;
    const res = await api(`/api/submissions/${subId}/grade`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ score: Number(g.score), feedback: g.feedback || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Nilai tersimpan");
      detail.reload();
    }
  }

  async function ingatkan(kind: "reminder" | "thanks") {
    if (!id) return;
    const res = await api("/api/tasks/nudge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: id, kind }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else setMsg(`Terkirim: ${d.inapp} in-app + ${d.wa} WA`);
  }

  if (!detail.data && detail.loading) return <Note>Memuat…</Note>;
  if (detail.error) return <Err>Gagal: {detail.error}</Err>;
  if (!detail.data) return <Note>Memuat…</Note>;
  const t = detail.data;
  return (
    <>
      <PageHead
        kicker="Tugas"
        title={t.task.title}
        desc={`Kelas: ${t.task.class.name}`}
        right={<Badge status={t.visible ? "AKTIF" : "PENDING"}>{t.visible ? "Terlihat siswa" : "Terjadwal/belum publish"}</Badge>}
      />
      <Panel style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{t.task.instruction}</p>
        <SegStat stats={[
          { label: "Terkumpul", value: t.submissions.length },
          { label: "Belum", value: t.pending.length },
        ]} />
        <Toolbar>
          <Btn type="button" onClick={() => ingatkan("reminder")}>Kirim pengingat ke yang belum mengumpulkan</Btn>
          <Btn kind="ghost" type="button" onClick={() => ingatkan("thanks")}>Kirim terima kasih ke yang sudah mengumpulkan</Btn>
        </Toolbar>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Pengumpulan</h2>
        {t.submissions.length === 0 && <Note>Belum ada yang mengumpulkan.</Note>}
        {t.submissions.length > 0 && (
          <WarmTable head={["Nama", "Waktu", "Terlambat", "File/Link", "Nilai", "Beri nilai"]}>
            {t.submissions.map((s) => (
              <tr key={s.id}>
                <td style={warmCell({ fontWeight: 700 })}>{s.student.name}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{new Date(s.submittedAt).toLocaleString("id-ID")}</td>
                <td style={warmCell()}>{s.isLate ? <Badge status="TERLAMBAT">Ya</Badge> : "Tidak"}</td>
                <td style={warmCell()}>
                  {s.fileName && <a href={`/api/task-files/${t.task.id}/${s.fileName}`}>unduh</a>}
                  {s.link && <> <a href={s.link} target="_blank" rel="noreferrer">tautan</a></>}
                  {s.text && <span> (teks)</span>}
                </td>
                <td style={warmCell({ fontWeight: 700 })}>{s.score ?? "-"}</td>
                <td style={warmCell()}>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <TextInput
                      type="number" min={0} max={100} placeholder="0-100" style={{ width: 80 }}
                      value={grades[s.id]?.score ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { score: e.target.value, feedback: grades[s.id]?.feedback ?? "" } })}
                    />
                    <TextInput
                      placeholder="umpan balik" style={{ minWidth: 140 }}
                      value={grades[s.id]?.feedback ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { score: grades[s.id]?.score ?? "", feedback: e.target.value } })}
                    />
                    <Btn kind="ghost" type="button" onClick={() => nilai(s.id)}>Simpan</Btn>
                  </span>
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Belum mengumpulkan ({t.pending.length})</h2>
        {t.pending.length === 0 && <Note>Semua sudah mengumpulkan.</Note>}
        {t.pending.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 14 }}>
            {t.pending.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
