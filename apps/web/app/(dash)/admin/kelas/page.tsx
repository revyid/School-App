"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClassRow {
  id: string; name: string; gradeLevel: string | null;
  homeroomTeacher: { id: string; name: string } | null;
  _count: { students: number };
}

export default function ClassesPage() {
  const { data, loading, error, reload } = useFetch<{ rows: ClassRow[]; total: number }>(`/api/classes?page=1&perPage=100`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=100`);
  const [name, setName] = useState("");
  const [homeroom, setHomeroom] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  async function create() {
    if (!name.trim()) return;
    const res = await api("/api/classes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), homeroomTeacherId: homeroom || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setName(""); setHomeroom("");
    reload();
  }

  async function remove(id: string, n: string) {
    setDeleteTarget({ id, name: n });
  }

  async function doRemove() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    const res = await api(`/api/classes/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  return (
    <>
      <PageHead kicker="Data master" title="Kelas" desc="Kelola rombel dan wali kelasnya." />
      <Card className="mb-4">
        {loading && <Alert>Memuat…</Alert>}
        {error && <Alert variant="destructive">Error: {error}</Alert>}
        {data && data.rows.length === 0 && <Alert>Belum ada kelas. Tambahkan di bawah.</Alert>}
        {data && data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Nama"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Wali Kelas"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Siswa"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Aksi"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {data.rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-bold">{c.name}</TableCell>
                <TableCell>{c.homeroomTeacher?.name ?? "-"}</TableCell>
                <TableCell>{c._count.students}</TableCell>
                <TableCell><Button variant="sticker-ghost" onClick={() => remove(c.id, c.name)}>Hapus</Button></TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <Card>
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Tambah kelas</h2>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Input className="max-w-[220px]" placeholder="Nama kelas (mis. VII-A)" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={homeroom} onValueChange={(v) => setHomeroom(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Tanpa wali kelas" /></SelectTrigger>
            <SelectPositioner><SelectPopup>
              {teachers?.rows.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectPopup></SelectPositioner>
          </Select>
          <Button variant="sticker" onClick={create}>Tambah</Button>
        </div>
      </Card>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Kelas"
        message={deleteTarget ? `Hapus kelas ${deleteTarget.name}?` : ""}
        confirmLabel="Ya, hapus"
        onConfirm={doRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
