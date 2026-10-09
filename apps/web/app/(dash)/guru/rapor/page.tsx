"use client";

// Rapor: tabel agregasi tugas + asesmen per siswa + ekspor .xlsx.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, WarmTable, warmCell, Note, Err, LinkBtn } from "@/components/DashUI";

export default function RaporPage() {
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
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
              {kelasUnik.map((r) => (
                <option key={r.class.id} value={r.class.id}>{r.class.name}</option>
              ))}
            </TextSelect>
          </label>
        </Toolbar>
        {gb.loading && <Note>Memuat…</Note>}
        {gb.error && <Err>Gagal: {gb.error}</Err>}
        {gb.data && gb.data.rows.length === 0 && <Note>Belum ada siswa/nilai di kelas ini.</Note>}
        {gb.data && gb.data.rows.length > 0 && (
          <WarmTable head={["Nama", ...gb.data.tasks.map((t) => t.title), ...gb.data.assessments.map((x) => x.title), "Rata-rata"]}>
            {gb.data.rows.map((r) => (
              <tr key={r.studentId}>
                <td style={warmCell({ fontWeight: 700, position: "sticky", left: 0, background: "#fffdf8", zIndex: 1 })}>{r.name}</td>
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
