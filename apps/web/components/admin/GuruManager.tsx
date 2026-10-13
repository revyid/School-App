"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import {
  Panel,
  TextInput,
  TextSelect,
  Btn,
  Badge,
  Note,
  Err,
  LinkBtn,
} from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";
import { DataTable, selectColumn, actionsColumn } from "@/components/ui/data-table";

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

  // Modal / form edit penugasan guru
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
        <Badge status={row.original.isActive ? "AKTIF" : "NONAKTIF"}>
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

      {/* Modal / Panel Edit Guru & Penugasan */}
      {editingTeacher && (
        <Panel style={{ marginBottom: 20, border: "2px solid #e85e43", background: "#fffdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 className="display" style={{ fontSize: 19, margin: 0 }}>
              Edit Penugasan: <span style={{ color: "#e85e43" }}>{editingTeacher.name}</span>
            </h2>
            <Btn kind="ghost" onClick={() => setEditingTeacher(null)}>Tutup</Btn>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
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
              <TextSelect value={editHomeroom} onChange={(e) => setEditHomeroom(e.target.value)}>
                <option value="">Bukan Wali Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Btn onClick={saveTeacherEdit} disabled={submitting}>
              {submitting ? "Menyimpan…" : "Simpan Perubahan Identitas & Wali Kelas"}
            </Btn>
          </div>

          {/* Mapel yang diampu guru ini — dibaca LIVE dari jadwal (read-only).
              Untuk mengubah, atur slot di /admin/jadwal. */}
          <div style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Mata Pelajaran yang Diampu Guru Ini:</h3>
            {(!editingTeacher.taughtFromSlots || editingTeacher.taughtFromSlots.length === 0) ? (
              <p style={{ color: "#74746d", fontSize: 13 }}>Belum mengampu mata pelajaran di kelas manapun. Atur lewat <LinkBtn href="/admin/jadwal">Jadwal</LinkBtn>.</p>
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
        </Panel>
      )}

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
              <TextSelect value={filterWali} onChange={(e) => setFilterWali(e.target.value as typeof filterWali)} style={{ minHeight: 44 }}>
                <option value="semua">Semua</option>
                <option value="wali">Wali kelas saja</option>
                <option value="nonwali">Bukan wali kelas</option>
              </TextSelect>
            </label>
          )}
          bulkActions={[
            { label: "Aktifkan terpilih", onClick: (ids) => setAktifBulk(ids, true) },
            { label: "Nonaktifkan terpilih", onClick: (ids) => setAktifBulk(ids, false) },
          ]}
          emptyText="Tidak ada guru yang cocok."
        />
      </Panel>

      {/* Form Tambah Guru Baru */}
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 14px" }}>
          Tambah Guru Baru
        </h2>
        <form onSubmit={create} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Nama Lengkap Guru *:
              <TextInput
                placeholder="Contoh: Budi Santoso, S.Pd."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Alamat Email *:
              <TextInput
                type="email"
                placeholder="budi@sekolah.sch.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
              Wali Kelas (Opsional):
              <TextSelect value={homeroomClassId} onChange={(e) => setHomeroomClassId(e.target.value)}>
                <option value="">Bukan Wali Kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Kelas {c.name}
                  </option>
                ))}
              </TextSelect>
            </label>
          </div>

          <p style={{ color: "#74746d", fontSize: 12, margin: "12px 0 0" }}>
            Penugasan mata pelajaran diatur lewat <LinkBtn href="/admin/jadwal">Jadwal</LinkBtn> —
            buat slot dengan guru ini, otomatis tampil di profilnya.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <Btn type="submit" style={{ minHeight: 44 }}>
              + Daftarkan Guru
            </Btn>
          </div>
        </form>
      </Panel>
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
