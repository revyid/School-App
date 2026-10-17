"use client";

// Rapor: tabel agregasi tugas + asesmen per siswa + ekspor .xlsx.
import { useState } from "react";
import { useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      <PageHead className="flex gap-2 no-underline bg-ink text-cream"
        kicker="Nilai"
        title="Rapor kelas"
        desc="Agregasi nilai tugas dan asesmen per siswa, siap diekspor ke Excel."
        right={classId ? (
          <span >
            <button type="button" className={buttonVariants({ variant: "sticker-ghost" })} onClick={(e) => { e.preventDefault(); window.print(); }}>Cetak / PDF</button>
            <a className={buttonVariants({ variant: "sticker" })} href={`/api/gradebook/export?classId=${encodeURIComponent(classId)}`} target="_blank" rel="noreferrer">Ekspor .xlsx</a>
          </span>
        ) : undefined}
      />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="flex gap-2 items-center text-[13px] text-muted">
            Kelas:
            <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="— pilih kelas —" /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                {kelasUnik.map((r) => (
                  <SelectItem key={r.class.id} value={r.class.id}>{r.class.name}</SelectItem>
                ))}
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
        </div>
        {gb.loading && <Alert>Memuat…</Alert>}
        {gb.error && <Alert variant="destructive">Gagal: {gb.error}</Alert>}
        {gb.data && gb.data.rows.length === 0 && <Alert>Belum ada siswa/nilai di kelas ini.</Alert>}
        {gb.data && gb.data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Nama"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{...gb.data.tasks.map((t) => t.title)}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{...gb.data.assessments.map((x) => x.title)}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Rata-rata"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {gb.data.rows.map((r) => (
              <TableRow key={r.studentId}>
                <TableCell className="font-bold sticky left-[0px] bg-cream z-[1]">{r.name}</TableCell>
                {gb.data!.tasks.map((t) => <TableCell key={t.id}>{r.taskScores[t.id] ?? "-"}</TableCell>)}
                {gb.data!.assessments.map((x) => <TableCell key={x.id}>{r.assessScores[x.id] ?? "-"}</TableCell>)}
                <TableCell className="font-extrabold">{r.avg ?? "-"}</TableCell>
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
