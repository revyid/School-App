"use client";

// Rapor: tabel agregasi tugas + asesmen per siswa + ekspor .xlsx.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, WarmTable, warmCell, Note, Err, LinkBtn } from "@/components/DashUI";

export default function RaporPage() {
  const [classId, setClassId] = useState("");
  const gb = useFetch<{
    tasks: { id: string; title: string }[];
    assessments: { id: string; title: string }[];
    rows: { studentId: string; name: string; taskScores: Record<string, number | null>; assessScores: Record<string, number | null>; avg: number | null }[];
  }>(classId ? `/api/gradebook?classId=${encodeURIComponent(classId)}` : null);

  return (
    <>
      <PageHead
        kicker="Nilai"
        title="Rapor kelas"
        desc="Agregasi nilai tugas dan asesmen per siswa, siap diekspor ke Excel."
        right={classId ? <LinkBtn kind="dark" href={`/api/gradebook/export?classId=${encodeURIComponent(classId)}`} target="_blank" rel="noreferrer">Ekspor .xlsx</LinkBtn> : undefined}
      />
      <Panel>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            ID kelas:
            <TextInput value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="classId" style={{ width: 280 }} />
          </label>
        </Toolbar>
        {gb.loading && <Note>Memuat…</Note>}
        {gb.error && <Err>Gagal: {gb.error}</Err>}
        {gb.data && gb.data.rows.length === 0 && <Note>Belum ada siswa/nilai di kelas ini.</Note>}
        {gb.data && gb.data.rows.length > 0 && (
          <WarmTable head={["Nama", ...gb.data.tasks.map((t) => t.title), ...gb.data.assessments.map((x) => x.title), "Rata-rata"]}>
            {gb.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td style={warmCell({ fontWeight: 700 })}>{r.name}</td>
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
