"use client";

// Admin: viewer audit log (pagination cursor).
import { useState } from "react";
import { api } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface Row {
  id: string; action: string; actor: string; role: string;
  entity: string | null; entityId: string | null; ip: string | null; createdAt: string;
}

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function muat(reset: boolean) {
    const c = reset ? null : cursor;
    const res = await api(`/api/audit?take=50${action ? `&action=${encodeURIComponent(action)}` : ""}${c ? `&cursor=${c}` : ""}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setRows(reset ? d.rows : [...rows, ...d.rows]);
      setCursor(d.nextCursor);
    }
  }

  return (
    <>
      <PageHead kicker="Keamanan" title="Audit log" desc="Jejak append-only semua aksi penting di sekolah ini." />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter aksi, mis. LEAVE.REVIEW" className="max-w-[300px]" />
          <Button variant="sticker" type="button" onClick={() => muat(true)}>Muat</Button>
        </div>
        {msg && <Alert variant="destructive">{msg}</Alert>}
        {rows.length === 0 && <Alert>Belum ada baris. Tekan Muat untuk menampilkan.</Alert>}
        {rows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Pelaku</TableHead>
                <TableHead>Entitas</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap font-meta text-xs">{r.createdAt.slice(0, 19).replace("T", " ")}</TableCell>
                  <TableCell className="font-bold">{r.action}</TableCell>
                  <TableCell>{r.actor} ({r.role})</TableCell>
                  <TableCell>{r.entity ?? "-"} {r.entityId?.slice(0, 8) ?? ""}</TableCell>
                  <TableCell>{r.ip ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {cursor && <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker-ghost" type="button" onClick={() => muat(false)}>Muat lagi</Button></div>}
      </Card>
    </>
  );
}
