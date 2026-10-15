"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import {
  Panel,
  TextInput,
  Note,
  Err,
  Toolbar,
} from "@/components/DashUI";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DataTable, selectColumn, actionsColumn } from "@/components/ui/data-table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";

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
          <span style={{ fontWeight: 700 }}>
            {t.name}
            {t.email && <div style={{ fontWeight: 400, fontSize: 12, color: "#74746d" }}>{t.email}</div>}
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
          <span
            style={{
              background: "#aec6a4", padding: "3px 10px", borderRadius: 99,
              fontWeight: 700, fontSize: 12, border: "1px solid #171716",
            }}
          >
            Kelas {nm}
          </span>
        ) : (<span style={{ color: "#a0a096" }}>-</span>);
      },
    },
    {
      id: "mapel",
      header: "Mapel & Kelas Diampu",
      cell: ({ row }) => {
        const taught = row.original.taughtFromSlots ?? [];
        if (taught.length === 0) return <span style={{ color: "#a0a096" }}>Belum ada mapel</span>;
        return (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 280 }}>
            {taught.map((tc) => (
              <span
                key={`${tc.teacherId}:${tc.classId}:${tc.subject ?? "-"}`}
                style={{ background: "#eeeadd", padding: "2px 8px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap" }}
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
      <Toolbar>
        <Button variant="sticker" onClick={() => setAddOpen(true)}>+ Tambah Guru</Button>
      </Toolbar>
      {lastPw && (
        <div
          style={{
            background: "#f5c94a",
            color: "#171716",
            padding: "12px 18px",
            borderRadius: 14,
            fontWeight: 700,
            marginBottom: 16,
            border: "2px solid #171716",
          }}
        >
          Password sementara guru baru (simpan sekarang, hanya muncul sekali):{" "}
          <code style={{ background: "#fffdf8", padding: "2px 8px", borderRadius: 6, fontSize: 15 }}>
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
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nama Guru:
              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Email:
              <TextInput value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
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
            <Button variant="sticker" onClick={saveTeacherEdit} disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Menyimpan…" : "Simpan"}
            </Button>
            <div style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Mata Pelajaran yang Diampu Guru Ini:</h3>
              {(!editingTeacher.taughtFromSlots || editingTeacher.taughtFromSlots.length === 0) ? (
                <p style={{ color: "#74746d", fontSize: 13 }}>Belum mengampu mata pelajaran di kelas manapun. Atur lewat <a className={buttonVariants({ variant: "sticker-ghost" })} style={{ textDecoration: "none" }} href="/admin/jadwal">Jadwal</a>.</p>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {editingTeacher.taughtFromSlots.map((tc) => (
                    <span
                      key={`${tc.teacherId}:${tc.classId}:${tc.subject ?? "-"}`}
                      style={{
                        background: "#eeeadd",
                        border: "1px solid rgba(23,23,22,.2)",
                        borderRadius: 99,
                        padding: "4px 12px",
                        fontSize: 13,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <strong>{tc.subject ?? "Mapel"}</strong> (Kelas {tc.class.name})
                    </span>
                  ))}
                </div>
              )}
              <p style={{ color: "#74746d", fontSize: 12, margin: 0 }}>Penugasan mapel diatur lewat jadwal, bukan di sini.</p>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Tabel Data Guru */}
      <Panel style={{ marginBottom: 20 }}>
        <DataTable<TeacherRow>
          columns={columns}
          rows={tampil}
          getRowId={(t) => t.id}
          searchValue={q}
          onSearchChange={setQ}
          searchPlaceholder="Cari nama / email guru…"
          filters={(
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Wali kelas:
              <Select value={filterWali} onValueChange={(v) => setFilterWali((v as typeof filterWali) ?? "semua")}>
                <SelectTrigger style={{ minHeight: 44 }}><SelectValue /></SelectTrigger>
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
      </Panel>

      {/* Sheet Tambah Guru Baru */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Tambah Guru</SheetTitle>
            <SheetDescription>Daftarkan satu guru. Penugasan mapel diatur lewat Jadwal.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <form onSubmit={create} style={{ display: "grid", gap: 14 }}>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                Nama Lengkap Guru *:
                <TextInput placeholder="Contoh: Budi Santoso, S.Pd." value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
                Alamat Email *:
                <TextInput type="email" placeholder="budi@sekolah.sch.id" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
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
              <Button variant="sticker" type="submit" style={{ minHeight: 44 }}>Daftarkan Guru</Button>
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
