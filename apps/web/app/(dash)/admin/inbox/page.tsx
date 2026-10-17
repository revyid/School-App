"use client";

// Admin: reveal pengirim anonim (tercatat audit) + daftar thread.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CollabAdminPage() {
  const { data, loading, reload } = useFetch<{ rows: { id: string; subject: string; anonymous: boolean; sender: string; revealed: boolean }[] }>(
    "/api/collab",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function reveal(id: string) {
    const res = await api(`/api/collab/${id}/reveal`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(`Pengirim: ${d.sender?.name ?? "?"}`);
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Komunikasi" title="Inbox kolaborasi" desc="Reveal hanya untuk pesan anonim dan selalu tercatat di audit log." />
      <Card>
        {loading && <Alert>Memuat…</Alert>}
        {msg && <p className="font-bold">{msg}</p>}
        {data && data.rows.length === 0 && <Alert>Belum ada thread.</Alert>}
        {data && data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Subjek"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Pengirim"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Status"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{""}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {data.rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-bold">{t.subject}</TableCell>
                <TableCell>{t.sender}</TableCell>
                <TableCell>
                  {t.anonymous ? <Badge variant={statusVariant(t.revealed ? "AKTIF" : "PENDING")}>{t.revealed ? "revealed" : "anonim"}</Badge> : <Badge variant={statusVariant("AKTIF")}>terbuka</Badge>}
                </TableCell>
                <TableCell>
                  {t.anonymous && !t.revealed && (
                    <Button variant="sticker-ghost" type="button" onClick={() => reveal(t.id)}>Reveal pengirim</Button>
                  )}
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
