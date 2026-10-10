"use client";

// Admin: kalender akademik (hari libur / hari efektif per bulan).
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";

interface CalRow {
  id: string;
  date: string;
  kind: string;
  note: string | null;
  class: { id: string; name: string } | null;
}

function thisMonth(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function KalenderPage() {
  const [month, setMonth] = useState(thisMonth());
  const { data, loading, error, reload } = useFetch<{ rows: CalRow[] }>(`/api/attendance/calendar?month=${month}`);
  const classes = useFetch<{ rows: { id: string; name: string }[] }>("/api/classes?page=1&perPage=100");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("LIBUR");
  const [classId, setClassId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/attendance/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, kind, classId: classId || null, note: note || null }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Tersimpan");
      setDate("");
      setNote("");
      reload();
    }
  }

  async function hapus(id: string) {
    setDeleteTarget(id);
  }

  async function doHapus() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    const res = await api(`/api/attendance/calendar?id=${id}`, { method: "DELETE" });
    if (!res.ok) setMsg("Gagal menghapus");
    else reload();
  }

  return (
    <>
      <PageHead kicker="Akademik" title="Kalender akademik" desc="Tandai hari libur dan hari efektif khusus per bulan." />
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#74746d" }}>
            Bulan:
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: "auto" }} />
          </label>
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Gagal: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Bulan ini belum ada hari khusus.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Tanggal", "Jenis", "Kelas", "Catatan", ""]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ whiteSpace: "nowrap", fontWeight: 700 })}>{r.date.slice(0, 10)}</td>
                <td style={warmCell()}><Badge status={r.kind === "LIBUR" ? "ALPHA" : "AKTIF"}>{r.kind}</Badge></td>
                <td style={warmCell()}>{r.class?.name ?? "Semua"}</td>
                <td style={warmCell()}>{r.note ?? "-"}</td>
                <td style={warmCell()}><Btn kind="ghost" type="button" onClick={() => hapus(r.id)}>Hapus</Btn></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah / ubah hari</h2>
        <form onSubmit={save} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Tanggal:
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ width: "auto" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Jenis:
            <TextSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="LIBUR">LIBUR</option>
              <option value="EFEKTIF">EFEKTIF (masuk walau tanpa jadwal)</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Kelas (kosongkan = semua sekolah):
            <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Semua</option>
              {classes.data?.rows.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Catatan:
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />
          </label>
          <Toolbar><Btn type="submit">Simpan</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Hari Khusus"
        message="Hapus hari khusus ini dari kalender akademik?"
        confirmLabel="Ya, hapus"
        onConfirm={doHapus}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
