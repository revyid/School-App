"use client";

// Dashboard super-admin: agregat /api/admin/health (semua sekolah).
import { useEffect, useState } from "react";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge, statusVariant } from "@/components/ui/badge";

interface Health {
  schoolCount: number;
  schools: { id: string; slug: string; name: string }[];
  queues: Record<string, { waiting: number; failed: number }>;
  wa: { rows?: { schoolId: string; slug: string; connected: boolean; detail: string }[] } & Record<string, unknown>;
  disk: Record<string, unknown>;
  backup: { lastAt: string | null; lastResult: string | null };
  time: string;
}

export default function PantauPage() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/health").then(async (r) => {
      if (!r.ok) {
        setError(`Gagal memuat (${r.status})`);
        return;
      }
      setH(await r.json());
    }).catch((e) => setError(String(e)));
  }, []);

  if (error) return <Alert variant="destructive">{error}</Alert>;
  if (!h) return <Alert>Memuat…</Alert>;

  return (
    <>
      <PageHead
        kicker="Platform"
        title={`Pantau (${h.schoolCount} sekolah)`}
        desc={`Backup: ${h.backup.lastAt ?? "belum pernah"} (${h.backup.lastResult ?? "-"})`}
      />
      <Card className="mb-4">
        <h2 className="display mb-3 text-[18px]">Antrean</h2>
        <SegStat stats={Object.entries(h.queues).map(([q, s]) => ({ label: q, value: `${s.waiting} tunggu / ${s.failed} gagal` }))} />
      </Card>
      <Card className="mb-4">
        <h2 className="display mb-3 text-[18px]">WhatsApp</h2>
        {(h.wa.rows ?? []).length === 0 && <Alert>Tidak ada data WA.</Alert>}
        {(h.wa.rows ?? []).length > 0 && (
          <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="min-w-[560px] text-[13.5px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  {["Sekolah", "Status"].map((head) => (
                    <TableHead key={head} className="whitespace-nowrap text-[10px] tracking-[.09em]">{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(h.wa.rows ?? []).map((r) => (
                  <TableRow key={r.schoolId}>
                    <TableCell className="font-bold">{r.slug}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.connected ? "AKTIF" : "ALPHA")}>{r.connected ? "terhubung" : `putus (${r.detail})`}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="display mb-3 text-[18px]">Sekolah</h2>
        <ul className="m-0 grid list-disc gap-1 pl-[18px] text-sm">
          {h.schools.map((s) => (
            <li key={s.id}>{s.name} ({s.slug})</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
