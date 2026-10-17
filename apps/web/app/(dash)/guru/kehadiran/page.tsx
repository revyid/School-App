"use client";

// Rekap kehadiran harian per kelas (guru: hanya kelasnya — server menolak yang lain).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Row {
  studentId: string;
  name: string;
  nisn: string | null;
  record: { status: string; source: string; scannedAt: string | null; note: string | null } | null;
}

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function KehadiranPage() {
  const [date, setDate] = useState(todayStr());
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const daily = useFetch<{ rows: Row[]; summary: Record<string, number> }>(
    classId ? `/api/attendance/daily?date=${date}&classId=${classId}` : null,
  );
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function saveManual(studentId: string) {
    const status = edit[studentId];
    if (!status) return;
    const res = await api("/api/attendance/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, date, status }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Tersimpan: ${status}`);
      daily.reload();
    }
  }

  const s = daily.data?.summary;
  return (
    <>
      <PageHead
        kicker="Absensi"
        title="Kehadiran harian"
        desc="Pilih tanggal dan kelas, lalu tandai manual bila ada yang terlewat scan."
        right={<a className={cn(buttonVariants({ variant: "sticker-ghost" }), "no-underline")} href="/guru/scanner">Buka scanner</a>}
      />
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="flex gap-2 items-center text-[13px] text-muted">
            Tanggal: <Input className="w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex gap-2 items-center text-[13px] text-muted">
            Kelas:
            <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="— pilih —" /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                {kelasUnik.map((r) => (
                  <SelectItem key={r.class.id} value={r.class.id}>{r.class.name}</SelectItem>
                ))}
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
        </div>
        {s && (
          <SegStat stats={[
            { label: "Hadir", value: s.HADIR ?? 0 },
            { label: "Izin", value: s.IZIN ?? 0 },
            { label: "Sakit", value: s.SAKIT ?? 0 },
            { label: "Alpha", value: s.ALPHA ?? 0 },
            { label: "Belum tercatat", value: s.BELUM ?? 0 },
          ]} />
        )}
        {msg && <p className="font-bold">{msg}</p>}
        {daily.loading && <Alert>Memuat…</Alert>}
        {daily.error && <Alert variant="destructive">Gagal: {daily.error}</Alert>}
        {daily.data && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Nama"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"NISN"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Status"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Ubah manual"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {daily.data.rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold">{r.name}</TableCell>
                <TableCell>{r.nisn ?? "-"}</TableCell>
                <TableCell>
                  {r.record ? <><Badge variant={statusVariant(r.record.status)}>{r.record.status}</Badge> <span className="text-xs text-muted">({r.record.source})</span></> : <Badge variant={statusVariant("BELUM")}>BELUM</Badge>}
                </TableCell>
                <TableCell>
                  <span className="flex gap-[6px]">
                    <Select value={edit[r.studentId] ?? ""} onValueChange={(v) => setEdit({ ...edit, [r.studentId]: v ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectPositioner><SelectPopup>
                        <SelectItem value="HADIR">HADIR</SelectItem>
                        <SelectItem value="IZIN">IZIN</SelectItem>
                        <SelectItem value="SAKIT">SAKIT</SelectItem>
                        <SelectItem value="ALPHA">ALPHA</SelectItem>
                      </SelectPopup></SelectPositioner>
                    </Select>
                    <Button variant="sticker-ghost" type="button" onClick={() => saveManual(r.studentId)}>Simpan</Button>
                  </span>
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
