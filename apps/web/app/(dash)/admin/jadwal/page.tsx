"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import UploadPopup from "@/components/UploadPopup";
import { DataTable, selectColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface SlotRow {
  id: string; dayOfWeek: number; startTime: string; endTime: string;
  subjectName: string | null; subjectId: string | null;
  subjectRef: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null; teacherId: string | null;
}

interface AllRow {
  id: string; classId: string; className: string; dayOfWeek: number;
  startTime: string; endTime: string; subjectName: string | null; teacherName: string | null;
}

interface LiburRow {
  id: string; date: string; kind: string; note: string | null;
  class: { id: string; name: string; gradeLevel: string | null } | null;
}

interface EditState {
  id: string; day: string; start: string; end: string; subjectId: string; teacherId: string;
}

export default function TimetablePage() {
  // Banner bila datang dari /admin/mapel (tanpa useSearchParams agar tak perlu Suspense).
  const [dari] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("dari") : null,
  );
  const [impFile, setImpFile] = useState<File | null>(null);
  const { data: classes } = useFetch<{ rows: { id: string; name: string; gradeLevel: string | null }[] }>(`/api/classes?page=1&perPage=100`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const [classId, setClassId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { data, loading, error, reload } = useFetch<{ rows: SlotRow[] }>(
    classId ? `/api/timetable?classId=${classId}&r=${refresh}` : null,
  );
  const { data: allData, loading: allLoading } = useFetch<{ rows: AllRow[] }>(
    !classId ? `/api/timetable?scope=all&r=${refresh}` : null,
  );
  // Daftar mapel kelas ini dari jadwal (auto-mapping), fallback ke global bila kelas belum punya slot.
  const { data: mapelKelas } = useFetch<{ subjects: { id: string | null; name: string }[] }>(
    classId ? `/api/timetable/subjects?classId=${classId}` : null,
  );
  const { data: subjectsGlobal } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/subjects`);
  const mapelOpts = (mapelKelas && mapelKelas.subjects.length > 0)
    ? mapelKelas.subjects
    : (subjectsGlobal?.rows ?? []).map((s) => ({ id: s.id, name: s.name }));
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("07:45");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [liburPending, setLiburPending] = useState<string[] | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [impErrors, setImpErrors] = useState<{ baris: number; pesan: string }[]>([]);
  const [impMode, setImpMode] = useState<"replace" | "merge">("replace");
  const [impIsAll, setImpIsAll] = useState(false);
  // Panel libur
  const [liburDari, setLiburDari] = useState("");
  const [liburSampai, setLiburSampai] = useState("");
  const [liburNote, setLiburNote] = useState("");
  const [liburMsg, setLiburMsg] = useState<string | null>(null);
  const [liburScope, setLiburScope] = useState<string>("semua");
  const [liburRefresh, setLiburRefresh] = useState(0);
  const { data: liburData } = useFetch<{ rows: { id: string; date: string; kind: string; note: string | null; class: { id: string; name: string; gradeLevel: string | null } | null }[] }>(
    `/api/attendance/calendar?scope=${encodeURIComponent(liburScope)}&r=${liburRefresh}`,
  );

  function bump() { setRefresh((r) => r + 1); reload(); }

  async function add() {
    if (!classId) { alert("Pilih kelas"); return; }
    const res = await api("/api/timetable", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        classId, subjectId: subjectId || null, subjectName: "",
        teacherId: teacherId || null, dayOfWeek: Number(day), startTime: start, endTime: end,
      }),
    });
    if (!res.ok) { alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status)); return; }
    setSubjectId(""); setTeacherId("");
    bump();
  }

  function openEdit(s: SlotRow) {
    setEditMsg(null);
    setEdit({
      id: s.id, day: String(s.dayOfWeek), start: s.startTime, end: s.endTime,
      subjectId: s.subjectRef?.id ?? s.subjectId ?? "", teacherId: s.teacher?.id ?? s.teacherId ?? "",
    });
  }

  async function saveEdit() {
    if (!edit || !classId) return;
    const res = await api("/api/timetable", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: edit.id, classId,
        subjectId: edit.subjectId || null, subjectName: "",
        teacherId: edit.teacherId || null,
        dayOfWeek: Number(edit.day), startTime: edit.start, endTime: edit.end,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setEditMsg(d.error || `Gagal (${res.status})`); return; }
    setEdit(null);
    bump();
  }

  async function doRemove() {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    await api(`/api/timetable?id=${id}`, { method: "DELETE" });
    bump();
  }

  async function upload() {
    const f = impFile;
    if (!f) { setImpMsg("Pilih file .xlsx dulu"); return; }
    if (!impIsAll && !classId) { setImpMsg("Pilih kelas dulu (atau centang mode semua-kelas)"); return; }
    setImpMsg("Mengunggah…");
    setImpErrors([]);
    const form = new FormData();
    form.append("file", f);
    if (!impIsAll) form.append("classId", classId);
    const res = await api(`/api/timetable/import?mode=${impMode}`, { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImpMsg("Gagal: " + (d.error || res.status));
      setImpErrors(d.errors ?? []);
      return;
    }
    setImpMsg(`Import selesai: ${d.ok} ditambah, ${d.gagal} gagal`);
    setImpErrors(d.errors ?? []);
    setImpFile(null);
    bump();
  }

  function expandDates(dari: string, sampai: string): string[] {
    const out: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai)) return out;
    const a = new Date(dari + "T00:00:00Z");
    const b = new Date(sampai + "T00:00:00Z");
    if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return out;
    for (let t = a.getTime(); t <= b.getTime() && out.length < 365; t += 86400000) {
      out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
  }

  async function tambahLibur() {
    const dates = expandDates(liburDari, liburSampai);
    if (dates.length === 0) { setLiburMsg("Isi tanggal dari–sampai yang valid"); return; }
    setLiburMsg("Menyimpan…");
    const scopeBody: Record<string, string | null> = {};
    if (liburScope.startsWith("kelas:")) scopeBody.classId = liburScope.slice(6);
    else if (liburScope.startsWith("tingkat:")) scopeBody.gradeLevel = liburScope.slice(8);
    const res = await api("/api/attendance/calendar/batch", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ dates, kind: "LIBUR", note: liburNote.trim() || null, ...scopeBody }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setLiburMsg("Gagal: " + (d.error || res.status)); return; }
    setLiburMsg(`${d.ok} entri libur ditambah (${dates[0]} s/d ${dates[dates.length - 1]}). Absensi tanggal itu nonaktif.`);
    setLiburDari(""); setLiburSampai(""); setLiburNote("");
    setLiburRefresh((r) => r + 1);
  }

  async function hapusLiburBulk(ids: string[]) {
    if (ids.length === 0) return;
    setLiburPending(ids);
  }

  async function doHapusLiburBulk() {
    const ids = liburPending;
    setLiburPending(null);
    if (!ids || ids.length === 0) return;
    const res = await api("/api/attendance/calendar/batch", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setLiburMsg("Gagal: " + (d.error || res.status)); return; }
    setLiburMsg(`${d.ok} hari libur dihapus.`);
    setLiburRefresh((r) => r + 1);
  }

  const liburColumns: ColumnDef<LiburRow, unknown>[] = useMemo(() => [
    selectColumn<LiburRow>(),
    {
      accessorKey: "date",
      header: "Tanggal",
      cell: ({ row }) => (
        <span style={{ fontWeight: 700 }}>{new Date(row.original.date).toISOString().slice(0, 10)}</span>
      ),
    },
    {
      id: "jenis",
      header: "Jenis",
      cell: ({ row }) => (row.original.kind === "LIBUR" ? "Libur" : "Efektif"),
    },
    {
      id: "berlaku",
      header: "Berlaku",
      cell: ({ row }) => (row.original.class ? `Kelas ${row.original.class.name}` : "Semua kelas"),
    },
    {
      accessorKey: "note",
      header: "Keterangan",
      cell: ({ row }) => row.original.note ?? "-",
    },
  ], []);

  return (
    <>
      <PageHead kicker="Akademik" title="Jadwal pelajaran" desc="Atur slot mapel per kelas per hari." />
      {dari === "mapel" && (
        <Panel style={{ marginBottom: 16 }}>
          <Note>Mapel kini dikelola dari Jadwal: daftar mapel tiap kelas diambil otomatis dari slot di bawah. Tambah slot untuk menambah mapel.</Note>
        </Panel>
      )}
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectPositioner><SelectPopup>
              {classes?.rows.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectPopup></SelectPositioner>
          </Select>
          {classId && (
            <>
              <a className="btn-sticker btn-ghost" style={{ textDecoration: "none" }} href={`/api/timetable/export?classId=${classId}`}>Unduh Excel</a>
              <a className="btn-sticker btn-ghost" style={{ textDecoration: "none" }} href="/api/timetable/template">Unduh template</a>
            </>
          )}
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {!classId && (
          <>
            {allLoading && <Note>Memuat rekap…</Note>}
            {allData && allData.rows.length === 0 && <Note>Belum ada slot jadwal. Pilih kelas lalu tambah slot.</Note>}
            {allData && allData.rows.length > 0 && (
              <WarmTable head={["Hari", "Kelas", "Jam", "Mapel", "Guru"]}>
                {allData.rows.map((s) => (
                  <tr key={s.id}>
                    <td style={warmCell({ fontWeight: 700 })}>{DAY_FULL[s.dayOfWeek]}</td>
                    <td style={warmCell()}>{s.className}</td>
                    <td style={warmCell({ whiteSpace: "nowrap" })}>{s.startTime}–{s.endTime}</td>
                    <td style={warmCell()}>{s.subjectName ?? "-"}</td>
                    <td style={warmCell()}>{s.teacherName ?? "-"}</td>
                  </tr>
                ))}
              </WarmTable>
            )}
          </>
        )}
        {data && data.rows.length === 0 && <Note>Belum ada slot jadwal untuk kelas ini.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Hari", "Jam", "Mapel", "Guru", "Aksi"]}>
            {data.rows.map((s) => (
              <tr key={s.id}>
                <td style={warmCell({ fontWeight: 700 })}>{DAYS[s.dayOfWeek]}</td>
                <td style={warmCell({ whiteSpace: "nowrap" })}>{s.startTime}–{s.endTime}</td>
                <td style={warmCell()}>{s.subjectRef?.name ?? s.subjectName ?? "-"}</td>
                <td style={warmCell()}>{s.teacher?.name ?? "-"}</td>
                <td style={warmCell()}>
                  <span style={{ display: "inline-flex", gap: 8 }}>
                    <Button variant="sticker-ghost" onClick={() => openEdit(s)}>Edit</Button>
                    <Button variant="sticker-ghost" onClick={() => setDeleteTarget(s.id)}>Hapus</Button>
                  </span>
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      {classId && (
        <>
          <Panel style={{ marginBottom: 16 }}>
            <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah slot</h2>
            <Toolbar>
              <Select value={day} onValueChange={(v) => setDay(v ?? "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
              <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "auto" }} />
              <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "auto" }} />
              <Select value={subjectId} onValueChange={(v) => setSubjectId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {mapelOpts.map((s) => (
                    <SelectItem key={s.id ?? `nama:${s.name}`} value={s.id ?? ""}>
                      {s.name}{s.id ? "" : " (baru)"}
                    </SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
              <Select value={teacherId} onValueChange={(v) => setTeacherId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {teachers?.rows.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
              <Button variant="sticker" onClick={add}>Tambah</Button>
            </Toolbar>
            <Note>Mapel kelas ini ({mapelKelas?.subjects.length ?? 0}) diambil dari jadwal; bila kelas belum punya slot, daftar global dipakai.</Note>
          </Panel>
        </>
      )}
      <Panel style={{ marginTop: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Import dari Excel</h2>
        <Note>Mode per-kelas: Hari|Mulai|Selesai|Mapel|Guru (pilih kelas di atas dulu). Mode semua-kelas: Kelas|Hari|Mulai|Selesai|Mapel|Guru (satu file untuk semua kelas, tanpa pilih kelas). Maks 10MB. Nama mapel baru otomatis dibuat; guru/kelas tak dikenal dilaporkan per baris.</Note>
        <Toolbar>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={impIsAll} onChange={(e) => setImpIsAll(e.target.checked)} />
            Semua kelas
          </label>
          <Select value={impMode} onValueChange={(v) => setImpMode((v as "replace" | "merge") ?? "replace")}>
            <SelectTrigger title="Replace: hapus slot lama kelas di file. Merge: hanya tambah."><SelectValue /></SelectTrigger>
            <SelectPositioner><SelectPopup>
              <SelectItem value="replace">Replace (hapus lama)</SelectItem>
              <SelectItem value="merge">Merge (tambah saja)</SelectItem>
            </SelectPopup></SelectPositioner>
          </Select>
          <div style={{ flex: "1 1 280px", minWidth: 240 }}>
            <UploadPopup key={impMsg} label="Pilih file .xlsx" hint="Maks 10MB · format .xlsx" maxMb={10} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={setImpFile} />
          </div>
          <Button variant="sticker" onClick={upload}>Upload</Button>
          <a className="btn-sticker btn-ghost" style={{ textDecoration: "none" }} href={impIsAll ? "/api/timetable/template?mode=all" : "/api/timetable/template"}>Unduh template</a>
        </Toolbar>
        {impMsg && <Note>{impMsg}</Note>}
        {impErrors.length > 0 && (
          <WarmTable head={["Baris", "Kesalahan"]}>
            {impErrors.slice(0, 20).map((e, i) => (
              <tr key={i}>
                <td style={warmCell({ fontWeight: 700 })}>{e.baris}</td>
                <td style={warmCell()}>{e.pesan}</td>
              </tr>
            ))}
          </WarmTable>
        )}
        {impErrors.length > 20 && <Note>…dan {impErrors.length - 20} kesalahan lain.</Note>}
      </Panel>
      <Panel style={{ marginTop: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Hari Libur Sekolah</h2>
        <Note>Tambah rentang tanggal libur sekaligus untuk semua kelas, satu tingkatan, atau satu kelas. Saat hari libur, absensi otomatis nonaktif (rekap kosong, scan/input ditolak).</Note>
        <Toolbar>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Dari:
            <TextInput type="date" value={liburDari} onChange={(e) => setLiburDari(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Sampai:
            <TextInput type="date" value={liburSampai} onChange={(e) => setLiburSampai(e.target.value)} style={{ width: "auto" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Berlaku untuk:
            <Select value={liburScope} onValueChange={(v) => { setLiburScope(v ?? "semua"); setLiburRefresh((r) => r + 1); }}>
              <SelectTrigger style={{ minWidth: 180 }}><SelectValue placeholder="Semua kelas" /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="semua">Semua kelas</SelectItem>
                {[...new Set((classes?.rows ?? []).map((c) => c.gradeLevel).filter(Boolean))].map((g) => (
                  <SelectItem key={g as string} value={`tingkat:${g as string}`}>Tingkatan {g as string}</SelectItem>
                ))}
                {(classes?.rows ?? []).map((c) => (
                  <SelectItem key={c.id} value={`kelas:${c.id}`}>Kelas {c.name}</SelectItem>
                ))}
              </SelectPopup></SelectPositioner>
          </Select>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Keterangan:
            <TextInput placeholder="mis. Libur semester" value={liburNote} onChange={(e) => setLiburNote(e.target.value)} style={{ minWidth: 180 }} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Button variant="sticker" onClick={tambahLibur}>Tambah Libur</Button>
          </div>
        </Toolbar>
        {liburMsg && <Note>{liburMsg}</Note>}
        <DataTable<LiburRow>
          columns={liburColumns}
          rows={liburData?.rows ?? []}
          getRowId={(l) => l.id}
          bulkActions={[
            { label: "Hapus terpilih", danger: true, onClick: (ids) => hapusLiburBulk(ids) },
          ]}
          emptyText="Belum ada hari libur mendatang untuk cakupan ini."
        />
      </Panel>
      <Dialog open={edit !== null} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent aria-label="Edit slot jadwal">
          <DialogHeader>
            <DialogTitle>Edit slot</DialogTitle>
          </DialogHeader>
          {edit && (
          <>
          <Toolbar>
              <Select value={edit.day} onValueChange={(v) => setEdit({ ...edit, day: v ?? "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {DAY_FULL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
              <TextInput type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} style={{ width: "auto" }} />
              <TextInput type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} style={{ width: "auto" }} />
            </Toolbar>
            <Toolbar>
              <Select value={edit.subjectId} onValueChange={(v) => setEdit({ ...edit, subjectId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {mapelOpts.map((s) => (
                    <SelectItem key={s.id ?? `nama:${s.name}`} value={s.id ?? ""}>{s.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
              <Select value={edit.teacherId} onValueChange={(v) => setEdit({ ...edit, teacherId: v ?? "" })}>
                <SelectTrigger><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {teachers?.rows.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
            </Toolbar>
            {editMsg && <Err>{editMsg}</Err>}
            <DialogFooter>
              <Button variant="sticker-ghost" onClick={() => setEdit(null)}>Batal</Button>
              <Button variant="sticker" onClick={saveEdit}>Simpan</Button>
            </DialogFooter>
          </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Slot Jadwal"
        message="Hapus slot jadwal ini?"
        confirmLabel="Ya, hapus"
        onConfirm={doRemove}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={liburPending !== null}
        title="Hapus Hari Libur"
        message={liburPending ? `Hapus ${liburPending.length} hari libur terpilih?` : ""}
        confirmLabel="Ya, hapus"
        onConfirm={doHapusLiburBulk}
        onCancel={() => setLiburPending(null)}
      />
    </>
  );
}
