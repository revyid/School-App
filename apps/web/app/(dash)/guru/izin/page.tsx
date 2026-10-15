"use client";

// Guru: persetujuan izin siswa kelasnya (APPROVED mengecualikan auto-alpha).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";

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
    const res = await api(`/api/leave/${id}`, {
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
            <Select value={status} onValueChange={(v) => setStatus(v ?? "PENDING")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="PENDING">PENDING</SelectItem>
                <SelectItem value="APPROVED">APPROVED</SelectItem>
                <SelectItem value="REJECTED">REJECTED</SelectItem>
              </SelectPopup></SelectPositioner>
            </Select>
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
                <td style={warmCell()}><Badge variant={statusVariant(r.kind)}>{r.kind}</Badge></td>
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
                      <Button variant="sticker" type="button" onClick={() => review(r.id, "APPROVED")}>Setujui</Button>
                      <Button variant="sticker-ghost" type="button" onClick={() => review(r.id, "REJECTED")}>Tolak</Button>
                    </span>
                  ) : <Badge variant={statusVariant(r.status)}>{r.status}</Badge>}
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
