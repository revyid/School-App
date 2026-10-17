"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DataTable, selectColumn, actionsColumn } from "@/components/ui/data-table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { cn } from "@/lib/utils";

interface TeacherRow {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  homeroomOf?: { id: string; name: string }[];
  taughtFromSlots?: {
    teacherId: string;
    classId: string;
    subject: string | null;
    class: { id: string; name: string };
  }[];
}

export default function GuruManager() {
  const { data, loading, error, reload } = useFetch<{
    rows: TeacherRow[];
    total: number;
  }>(`/api/teachers?page=1&perPage=100`);

  const { data: classesData, reload: reloadClasses } = useFetch<{
    rows: { id: string; name: string }[];
  }>("/api/classes?page=1&perPage=100");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [homeroomClassId, setHomeroomClassId] = useState("");
  const [lastPw, setLastPw] = useState<string | null>(null);

  // Sheet tambah/edit guru
  const [addOpen, setAddOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHomeroom, setEditHomeroom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [q, setQ] = useState("");
  const [filterWali, setFilterWali] = useState<"semua" | "wali" | "nonwali">("semua");

  function askConfirm(title: string, message: string, action: () => Promise<void>) {
    setPending({ title, message, action });
  }

  async function runPending() {
    if (!pending) return;
    const act = pending.action;
    setPending(null);
    await act();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      alert("Nama dan email guru wajib diisi");
      return;
    }
    const res = await api("/api/teachers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        homeroomClassId: homeroomClassId || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Gagal: " + (d.error || res.status));
      return;
    }
    setLastPw(d.tempPassword);
    setName("");
    setEmail("");
    setHomeroomClassId("");
    setAddOpen(false);
    reload();
    reloadClasses();
  }

  function startEdit(t: TeacherRow) {
    setEditingTeacher(t);
    setEditName(t.name);
    setEditEmail(t.email ?? "");
    setEditHomeroom(t.homeroomOf?.[0]?.id ?? "");
  }

  async function saveTeacherEdit() {
    if (!editingTeacher) return;
    setSubmitting(true);
    try {
      const res = await api(`/api/teachers/${editingTeacher.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
          homeroomClassId: editHomeroom || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert("Gagal menyimpan guru: " + (d.error || res.status));
        return;
      }
      setEditingTeacher(null);
      reload();
      reloadClasses();
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPw(id: string, n: string) {
    askConfirm("Reset Password", `Reset password ${n}?`, async () => {
      const res = await api(`/api/teachers/${id}`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Gagal: " + (d.error || res.status));
        return;
      }
      setLastPw(d.tempPassword);
    });
  }

  async function toggle(id: string, active: boolean, n: string) {
    askConfirm(active ? "Nonaktifkan Guru" : "Aktifkan Guru", `${active ? "Nonaktifkan" : "Aktifkan"} ${n}?`, async () => {
      await api(`/api/teachers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !active }),
      });
      reload();
    });
  }

  async function setAktifBulk(ids: string[], aktif: boolean) {
    if (ids.length === 0) return;
    askConfirm(aktif ? "Aktifkan Guru" : "Nonaktifkan Guru", `${aktif ? "Aktifkan" : "Nonaktifkan"} ${ids.length} guru terpilih?`, async () => {
      for (const id of ids) {
        await api(`/api/teachers/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: aktif }),
        });
      }
      reload();
    });
  }

  const classes = classesData?.rows ?? [];
  const tampil = useMemo(() => (data?.rows ?? []).filter((t) => {
    if (q.trim() && !`${t.name} ${t.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (filterWali === "wali" && !(t.homeroomOf?.length)) return false;
    if (filterWali === "nonwali" && t.homeroomOf?.length) return false;
    return true;
  }), [data, q, filterWali]);

  const columns: ColumnDef<TeacherRow, unknown>[] = useMemo(() => [
    selectColumn<TeacherRow>(),
    {
      accessorKey: "name",
      header: "Nama Guru",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <span className="font-bold">
            {t.name}
            {t.email && <div className="font-normal text-xs text-muted">{t.email}</div>}
          </span>
        );
      },
    },
    {
      id: "wali",
      header: "Wali Kelas",
      cell: ({ row }) => {
        const nm = row.original.homeroomOf?.[0]?.name;
        return nm ? (
          <span className="bg-mint pt-[3px] pr-[10px] pb-[3px] pl-[10px] rounded-[99px] font-bold text-xs border border-solid border-ink"
            
          >
            Kelas {nm}
          </span>
        ) : (<span className="text-muted">-</span>);
      },
    },
    {
      id: "mapel",
      header: "Mapel & Kelas Diampu",
      cell: ({ row }) => {
        const taught = row.original.taughtFromSlots ?? [];
        if (taught.length === 0) return <span className="text-muted">Belum ada mapel</span>;
        return (
          <div className="flex gap-[4px] flex-wrap max-w-[280px]">
            {taught.map((tc) => (
              <span className="bg-paper-deep pt-[2px] pr-2 pb-[2px] pl-2 rounded-md text-[11px] whitespace-nowrap"
                key={`${tc.teacherId}:${tc.classId}:${tc.subject ?? "-"}`}
                
              >
                {tc.subject ?? "Mapel"} ({tc.class.name})
              </span>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.isActive ? "AKTIF" : "NONAKTIF")}>
          {row.original.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    actionsColumn<TeacherRow>((t) => [
      { label: "Atur penugasan", onClick: () => startEdit(t) },
      { label: "Reset password", onClick: () => resetPw(t.id, t.name) },
      { label: t.isActive ? "Nonaktifkan" : "Aktifkan", onClick: () => toggle(t.id, t.isActive, t.name) },
    ]),
  ], [startEdit, resetPw, toggle]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button variant="sticker" onClick={() => setAddOpen(true)}>+ Tambah Guru</Button>
      </div>
      {lastPw && (
        <div className="bg-sun text-ink pt-3 pr-[18px] pb-3 pl-[18px] rounded-[14px] font-bold mb-4 border-2 border-solid border-ink"
          
        >
          Password sementara guru baru (simpan sekarang, hanya muncul sekali):{" "}
          <code className="bg-cream pt-[2px] pr-2 pb-[2px] pl-2 rounded-md text-[15px]">
            {lastPw}
          </code>
        </div>
      )}

      {/* Sheet Edit Guru & Penugasan */}
      <Sheet open={editingTeacher !== null} onOpenChange={(o) => { if (!o) setEditingTeacher(null); }}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Edit Guru{editingTeacher ? `: ${editingTeacher.name}` : ""}</SheetTitle>
            <SheetDescription>Ubah identitas dan wali kelas. Penugasan mapel diatur lewat Jadwal.</SheetDescription>
          </SheetHeader>
          {editingTeacher && (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            <label className="grid gap-[6px] text-[13px] text-muted">
              Nama Guru:
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Email:
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Wali Kelas:
              <Select value={editHomeroom} onValueChange={(v) => setEditHomeroom(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Bukan Wali Kelas" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
            <Button className="w-full" variant="sticker" onClick={saveTeacherEdit} disabled={submitting}>
              {submitting ? "Menyimpan…" : "Simpan"}
            </Button>
            <div className="border-t border-line pt-[14px]">
              <h3 className="text-[15px] font-bold mt-0 mr-0 mb-[10px] ml-0">Mata Pelajaran yang Diampu Guru Ini:</h3>
              {(!editingTeacher.taughtFromSlots || editingTeacher.taughtFromSlots.length === 0) ? (
                <p className="text-muted text-[13px]">Belum mengampu mata pelajaran di kelas manapun. Atur lewat <a className={cn(buttonVariants({ variant: "sticker-ghost" }), "no-underline")} href="/admin/jadwal">Jadwal</a>.</p>
              ) : (
                <div className="flex gap-2 flex-wrap mb-[14px]">
                  {editingTeacher.taughtFromSlots.map((tc) => (
                    <span
                      className="bg-paper-deep border border-solid border-line rounded-[99px] pt-1 pr-3 pb-1 pl-3 text-[13px] inline-flex items-center gap-2"
                      key={`${tc.teacherId}:${tc.classId}:${tc.subject ?? "-"}`}
                    >
                      <strong>{tc.subject ?? "Mapel"}</strong> (Kelas {tc.class.name})
                    </span>
                  ))}
                </div>
              )}
              <p className="text-muted text-xs m-0">Penugasan mapel diatur lewat jadwal, bukan di sini.</p>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Tabel Data Guru */}
      <Card className="mb-5">
        <DataTable<TeacherRow>
          columns={columns}
          rows={tampil}
          getRowId={(t) => t.id}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Cari nama / email guru…"
          filters={(
            <label className="grid gap-[6px] text-[13px] text-muted">
              Wali kelas:
              <Select value={filterWali} onValueChange={(v) => setFilterWali((v as typeof filterWali) ?? "semua")}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  <SelectItem value="semua">Semua</SelectItem>
                  <SelectItem value="wali">Wali kelas saja</SelectItem>
                  <SelectItem value="nonwali">Bukan wali kelas</SelectItem>
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
          )}
          bulkActions={[
            { label: "Aktifkan terpilih", onClick: (ids) => setAktifBulk(ids, true) },
            { label: "Nonaktifkan terpilih", onClick: (ids) => setAktifBulk(ids, false) },
          ]}
          emptyText="Tidak ada guru yang cocok."
        />
      </Card>

      {/* Sheet Tambah Guru Baru */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Tambah Guru</SheetTitle>
            <SheetDescription>Daftarkan satu guru. Penugasan mapel diatur lewat Jadwal.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <form className="grid gap-[14px]" onSubmit={create}>
              <label className="grid gap-[6px] text-[13px] text-muted">
                Nama Lengkap Guru *:
                <Input placeholder="Contoh: Budi Santoso, S.Pd." value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="grid gap-[6px] text-[13px] text-muted">
                Alamat Email *:
                <Input type="email" placeholder="budi@sekolah.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="grid gap-[6px] text-[13px] text-muted">
                Wali Kelas (Opsional):
                <Select value={homeroomClassId} onValueChange={(v) => setHomeroomClassId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Bukan Wali Kelas" /></SelectTrigger>
                  <SelectPositioner><SelectPopup>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                    ))}
                  </SelectPopup></SelectPositioner>
                </Select>
              </label>
              <Button className="min-h-[44px]" variant="sticker" type="submit">Daftarkan Guru</Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        message={pending?.message ?? ""}
        confirmLabel="Ya, lanjutkan"
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
