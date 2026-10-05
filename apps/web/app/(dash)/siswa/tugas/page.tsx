"use client";

// Siswa: daftar tugas + filter Sudah/Belum/Terlambat.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextSelect, WarmTable, warmCell, Badge, Note, Err } from "@/components/DashUI";

interface TaskRow {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  subjectName: string | null;
  materials: number;
  state: string;
  score: number | null;
}

export default function SiswaTugasPage() {
  const [status, setStatus] = useState("semua");
  const { data, loading, error } = useFetch<{ rows: TaskRow[] }>(`/api/tasks?status=${status}`);

  return (
    <>
      <PageHead kicker="Belajar" title="Tugas saya" desc="Kerjakan sebelum deadline. Tepat waktu dapat XP lebih besar." />
      <Panel>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Filter:
            <TextSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="semua">Semua</option>
              <option value="belum">Belum dikumpulkan</option>
              <option value="sudah">Sudah dikumpulkan</option>
              <option value="terlambat">Terlambat/tutup</option>
            </TextSelect>
          </label>
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Tidak ada tugas pada filter ini.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Judul", "Mapel", "Deadline", "Status", "Nilai"]}>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td style={warmCell()}><a href={`/siswa/tugas/${t.id}`} style={{ fontWeight: 700, color: "#171716" }}>{t.title}</a></td>
                <td style={warmCell()}>{t.subjectName ?? "-"}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{t.deadline ? new Date(t.deadline).toLocaleString("id-ID") : "-"}</td>
                <td style={warmCell()}><Badge status={t.state} /></td>
                <td style={warmCell()}>{t.score ?? "-"}</td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
