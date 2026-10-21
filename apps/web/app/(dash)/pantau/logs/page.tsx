"use client";

// Root: audit log lintas sekolah (pagination cursor).
import { useState, type FormEvent } from "react";
import { api } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

interface Row {
  id: string;
  action: string;
  actor: { name: string; role: string };
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
}

export default function PantauLogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function muat(reset: boolean) {
    setBusy(true);
    setMsg(null);
    const c = reset ? null : cursor;
    const res = await api(
      `/api/root/audit?take=50${action ? `&action=${encodeURIComponent(action)}` : ""}${c ? `&cursor=${encodeURIComponent(c)}` : ""}`,
    );
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal memuat (${res.status})`);
    else {
      setRows(reset ? d.rows ?? [] : [...rows, ...(d.rows ?? [])]);
      setCursor(d.nextCursor ?? null);
    }
    setBusy(false);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void muat(true);
  }

  return (
    <>
      <PageHead
        kicker="Keamanan"
        title="Audit log platform"
        desc="Jejak aksi penting dari seluruh sekolah dan root admin."
      />
      <Card>
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2.5">
          <Input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Filter aksi, mis. LEAVE.REVIEW"
            aria-label="Filter aksi"
            className="max-w-[320px]"
          />
          <Button variant="sticker" type="submit" disabled={busy}>Muat</Button>
        </form>

        {msg && <Alert variant="destructive">{msg}</Alert>}
        {busy && rows.length === 0 && <Alert>Memuat log…</Alert>}
        {!busy && !msg && rows.length === 0 && <Alert>Belum ada baris. Tekan Muat untuk menampilkan.</Alert>}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  {["Aksi", "Pelaku", "Entitas", "Entity ID", "IP", "Waktu"].map((head) => (
                    <TableHead key={head} className="whitespace-nowrap text-[10px] tracking-[.09em]">{head}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold">{r.action}</TableCell>
                    <TableCell className="whitespace-nowrap text-[13px]">{r.actor.name} ({r.actor.role})</TableCell>
                    <TableCell className="text-[13px]">{r.entity ?? "–"}</TableCell>
                    <TableCell className="font-meta text-xs">{r.entityId ?? "–"}</TableCell>
                    <TableCell className="font-meta text-xs">{r.ip ?? "–"}</TableCell>
                    <TableCell className="whitespace-nowrap font-meta text-xs">
                      {r.createdAt.slice(0, 19).replace("T", " ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {cursor && (
          <div>
            <Button variant="sticker-ghost" type="button" disabled={busy} onClick={() => muat(false)}>
              Muat lagi
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
