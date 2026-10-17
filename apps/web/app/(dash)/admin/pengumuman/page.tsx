"use client";

// Admin: pengumuman CRUD-minimal (buat + daftar) + reveal thread anonim + atur expRules.
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

export default function PengumumanAdminPage() {
  const { data, reload } = useFetch<{ rows: { id: string; title: string; target: string }[] }>("/api/announcements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("ALL");
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, target }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Pengumuman terbit");
      setTitle("");
      setBody("");
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Komunikasi" title="Pengumuman" desc="Terbitkan info resmi untuk guru, siswa, atau semua warga sekolah." />
      <Card className="mb-4">
        <form className="grid gap-3 max-w-[560px]" onSubmit={buat}>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Judul:
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Isi:
            <textarea className="rounded-[14px] border border-solid border-line bg-cream pt-[9px] pr-[14px] pb-[9px] pl-[14px] text-sm" value={body} onChange={(e) => setBody(e.target.value)} required rows={4} />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Target:
            <Select value={target} onValueChange={(v) => setTarget(v ?? "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="GURU">Guru saja</SelectItem>
                <SelectItem value="SISWA">Siswa saja</SelectItem>
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" type="submit">Terbitkan</Button></div>
        </form>
        {msg && <p className="font-bold">{msg}</p>}
      </Card>
      <Card>
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Sudah terbit</h2>
        {!data && <Alert>Memuat…</Alert>}
        {data && data.rows.length === 0 && <Alert>Belum ada pengumuman.</Alert>}
        {data && data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Judul"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Target"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.title}</TableCell>
                <TableCell><Badge variant={statusVariant(r.target === "ALL" ? "AKTIF" : "IZIN")}>{r.target}</Badge></TableCell>
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
