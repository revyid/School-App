"use client";

// Admin: dashboard kehadiran (ringkasan hari ini per kelas) + ekspor bulanan.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  studentId: string;
  name: string;
  nisn: string | null;
  record: { status: string } | null;
}

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function AdminKehadiranPage() {
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const classes = useFetch<{ rows: { id: string; name: string }[] }>("/api/classes?page=1&perPage=100");
  const [classId, setClassId] = useState("");
  const daily = useFetch<{ rows: Row[]; summary: Record<string, number> }>(
    classId ? `/api/attendance/daily?date=${date}&classId=${classId}` : null,
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function exportMonthly() {
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await fetch(`/api/attendance/monthly?month=${month}&classId=${classId}`, { cache: "no-store" });
    if (!res.ok) {
      setMsg("Ekspor gagal");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rekap-${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Rekap bulanan terunduh");
  }

  async function cetakMassal() {
    if (!classId) {
      setMsg("Pilih kelas dulu");
      return;
    }
    const res = await api(`/api/attendance/daily?date=${date}&classId=${classId}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(d.error || "Gagal");
      return;
    }
    const ids: string[] = d.rows.map((r: Row) => r.studentId);
    const tokens: { name: string; token: string }[] = [];
    for (const id of ids) {
      const r = await fetch(`/api/attendance/qr?studentId=${id}`, { cache: "no-store" });
      const q = await r.json().catch(() => ({}));
      if (r.ok) tokens.push({ name: q.qr.student.name, token: q.qr.token });
    }
    const w = window.open("", "_blank");
    if (!w) {
      setMsg("Popup diblokir browser");
      return;
    }
    w.document.write(`<html><head><title>Kartu QR</title></head><body>${
      tokens.map((t) => `<div style="border:1px solid #000;margin:8px;padding:8px;display:inline-block"><b>${t.name}</b><br/><code>${t.token}</code></div>`).join("")
    }<script>window.print()</script></body></html>`);
    w.document.close();
  }

  const s = daily.data?.summary;
  return (
    <>
      <PageHead kicker="Absensi" title="Kehadiran sekolah" desc="Pantau kehadiran harian per kelas dan unduh rekap bulanan." />
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
                {classes.data?.rows.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          <label className="flex gap-2 items-center text-[13px] text-muted">
            Bulan: <Input className="w-auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <Button variant="sticker-ghost" type="button" onClick={exportMonthly}>Unduh rekap (.xlsx)</Button>
          <Button variant="sticker-ghost" type="button" onClick={cetakMassal}>Cetak kartu QR sekelas</Button>
        </div>
        {s && (
          <SegStat stats={[
            { label: "Hadir", value: s.HADIR ?? 0 },
            { label: "Izin", value: s.IZIN ?? 0 },
            { label: "Sakit", value: s.SAKIT ?? 0 },
            { label: "Alpha", value: s.ALPHA ?? 0 },
            { label: "Belum", value: s.BELUM ?? 0 },
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
                </TableRow>
              </TableHeader>
              <TableBody>
            {daily.data.rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold">{r.name}</TableCell>
                <TableCell>{r.nisn ?? "-"}</TableCell>
                <TableCell>{r.record ? <Badge variant={statusVariant(r.record.status)}>{r.record.status}</Badge> : <Badge variant={statusVariant("BELUM")}>BELUM</Badge>}</TableCell>
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
