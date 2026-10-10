"use client";

// Guru: persetujuan izin siswa kelasnya (APPROVED mengecualikan auto-alpha).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";

interface Row {
  id: string;
  date: string;
  kind: string;
  description: string;
  status: string;
  hasPhoto: boolean;
  student: { id: string; name: string };
}

export default function IzinGuruPage() {
  const [status, setStatus] = useState("PENDING");
  const { data, loading, error, reload } = useFetch<{ rows: Row[] }>(`/api/leave?status=${status}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    const res = await api(`/api/leave/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, note: notes[id] || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`${decision === "APPROVED" ? "Disetujui" : "Ditolak"}`);
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Perizinan" title="Persetujuan izin" desc="Setujui atau tolak pengajuan siswa kelasmu. Yang disetujui dikecualikan dari alpha otomatis." />
      <Panel>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Status:
            <TextSelect value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </TextSelect>
          </label>
        </Toolbar>
        {loading && <Note>Memuat...</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        {data && data.rows.length === 0 && <Note>Tidak ada pengajuan pada status ini.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Tanggal", "Nama", "Jenis", "Alasan", "Foto", "Catatan", "Aksi"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{r.date.slice(0, 10)}</td>
                <td style={warmCell({ fontWeight: 700 })}>{r.student.name}</td>
                <td style={warmCell()}><Badge status={r.kind} /></td>
                <td style={warmCell()}>{r.description}</td>
                <td style={warmCell()}>
                  {r.hasPhoto ? (
                    <a href={`/api/leave/${r.id}/photo?which=siswa`} target="_blank" rel="noreferrer" title="Buka foto bukti ukuran penuh">
                      <img
                        src={`/api/leave/${r.id}/photo?which=siswa`}
                        alt={`Bukti foto pengajuan ${r.student.name}`}
                        loading="lazy"
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(23,23,22,.2)", display: "block" }}
                      />
                    </a>
                  ) : "-"}
                </td>
                <td style={warmCell()}>
                  <TextInput
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    placeholder="catatan (opsional)"
                    style={{ minWidth: 140 }}
                  />
                </td>
                <td style={warmCell()}>
                  {r.status === "PENDING" ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <Btn type="button" onClick={() => review(r.id, "APPROVED")}>Setujui</Btn>
                      <Btn kind="ghost" type="button" onClick={() => review(r.id, "REJECTED")}>Tolak</Btn>
                    </span>
                  ) : <Badge status={r.status} />}
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
