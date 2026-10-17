"use client";

// Guru: persetujuan izin siswa kelasnya (APPROVED mengecualikan auto-alpha).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="flex gap-2 items-center text-[13px] text-muted">
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
        </div>
        {loading && <Alert>Memuat...</Alert>}
        {error && <Alert variant="destructive">Gagal: {error}</Alert>}
        {msg && <p className="font-bold">{msg}</p>}
        {data && data.rows.length === 0 && <Alert>Tidak ada pengajuan pada status ini.</Alert>}
        {data && data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Tanggal"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Nama"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Jenis"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Alasan"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Foto"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Catatan"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Aksi"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{r.date.slice(0, 10)}</TableCell>
                <TableCell className="font-bold">{r.student.name}</TableCell>
                <TableCell><Badge variant={statusVariant(r.kind)}>{r.kind}</Badge></TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell>
                  {r.hasPhoto ? (
                    <a href={`/api/leave/${r.id}/photo?which=siswa`} target="_blank" rel="noreferrer" title="Buka foto bukti ukuran penuh">
                      <img className="w-[72px] h-[72px] object-cover rounded-[10px] border border-solid border-line block"
                        src={`/api/leave/${r.id}/photo?which=siswa`}
                        alt={`Bukti foto pengajuan ${r.student.name}`}
                        loading="lazy"
                        
                      />
                    </a>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  <Input className="min-w-[140px]"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    placeholder="catatan (opsional)"
                    
                  />
                </TableCell>
                <TableCell>
                  {r.status === "PENDING" ? (
                    <span className="flex gap-[6px]">
                      <Button variant="sticker" type="button" onClick={() => review(r.id, "APPROVED")}>Setujui</Button>
                      <Button variant="sticker-ghost" type="button" onClick={() => review(r.id, "REJECTED")}>Tolak</Button>
                    </span>
                  ) : <Badge variant={statusVariant(r.status)}>{r.status}</Badge>}
                </TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </>
  );
}
