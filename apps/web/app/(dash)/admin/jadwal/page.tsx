"use client";

import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ConfirmDialog";
import UploadPopup from "@/components/UploadPopup";
import { DataTable, selectColumn } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=100`);
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
        <span className="font-bold">{new Date(row.original.date).toISOString().slice(0, 10)}</span>
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
        <Card className="mb-4">
          <Alert>Mapel kini dikelola dari Jadwal: daftar mapel tiap kelas diambil otomatis dari slot di bawah. Tambah slot untuk menambah mapel.</Alert>
        </Card>
      )}
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
            <SelectPositioner><SelectPopup>
              {classes?.rows.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectPopup></SelectPositioner>
          </Select>
          {classId && (
            <>
              <a className="btn-sticker btn-ghost no-underline" href={`/api/timetable/export?classId=${classId}`}>Unduh Excel</a>
              <a className="btn-sticker btn-ghost no-underline" href="/api/timetable/template">Unduh template</a>
            </>
          )}
        </div>
        {loading && <Alert>Memuat…</Alert>}
        {error && <Alert variant="destructive">Error: {error}</Alert>}
        {!classId && (
          <>
            {allLoading && <Alert>Memuat rekap…</Alert>}
            {allData && allData.rows.length === 0 && <Alert>Belum ada slot jadwal. Pilih kelas lalu tambah slot.</Alert>}
            {allData && allData.rows.length > 0 && (
                            <div className="warm-table overflow-x-auto rounded-2xl border border-line">
                <Table className="text-[13.5px] min-w-[560px]">
                  <TableHeader>
                    <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                      <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Hari"}</TableHead>
                      <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Kelas"}</TableHead>
                      <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Jam"}</TableHead>
                      <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Mapel"}</TableHead>
                      <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Guru"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                {allData.rows.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{DAY_FULL[s.dayOfWeek]}</TableCell>
                    <TableCell>{s.className}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.startTime}–{s.endTime}</TableCell>
                    <TableCell>{s.subjectName ?? "-"}</TableCell>
                    <TableCell>{s.teacherName ?? "-"}</TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
        {data && data.rows.length === 0 && <Alert>Belum ada slot jadwal untuk kelas ini.</Alert>}
        {data && data.rows.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Hari"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Jam"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Mapel"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Guru"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Aksi"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {data.rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-bold">{DAYS[s.dayOfWeek]}</TableCell>
                <TableCell className="whitespace-nowrap">{s.startTime}–{s.endTime}</TableCell>
                <TableCell>{s.subjectRef?.name ?? s.subjectName ?? "-"}</TableCell>
                <TableCell>{s.teacher?.name ?? "-"}</TableCell>
                <TableCell>
                  <span className="inline-flex gap-2">
                    <Button variant="sticker-ghost" onClick={() => openEdit(s)}>Edit</Button>
                    <Button variant="sticker-ghost" onClick={() => setDeleteTarget(s.id)}>Hapus</Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      {classId && (
        <>
          <Card className="mb-4">
            <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Tambah slot</h2>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <Select value={day} onValueChange={(v) => setDay(v ?? "1")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
              <Input className="w-auto" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input className="w-auto" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
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
            </div>
            <Alert>Mapel kelas ini ({mapelKelas?.subjects.length ?? 0}) diambil dari jadwal; bila kelas belum punya slot, daftar global dipakai.</Alert>
          </Card>
        </>
      )}
      <Card className="mt-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Import dari Excel</h2>
        <Alert>Mode per-kelas: Hari|Mulai|Selesai|Mapel|Guru (pilih kelas di atas dulu). Mode semua-kelas: Kelas|Hari|Mulai|Selesai|Mapel|Guru (satu file untuk semua kelas, tanpa pilih kelas). Maks 10MB. Nama mapel baru otomatis dibuat; guru/kelas tak dikenal dilaporkan per baris.</Alert>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-[6px] text-[13px]">
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
          <div className="flex-[1_1_280px] min-w-[240px]">
            <UploadPopup key={impMsg} label="Pilih file .xlsx" hint="Maks 10MB · format .xlsx" maxMb={10} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={setImpFile} />
          </div>
          <Button variant="sticker" onClick={upload}>Upload</Button>
          <a className="btn-sticker btn-ghost no-underline" href={impIsAll ? "/api/timetable/template?mode=all" : "/api/timetable/template"}>Unduh template</a>
        </div>
        {impMsg && <Alert>{impMsg}</Alert>}
        {impErrors.length > 0 && (
                    <div className="warm-table overflow-x-auto rounded-2xl border border-line">
            <Table className="text-[13.5px] min-w-[560px]">
              <TableHeader>
                <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Baris"}</TableHead>
                  <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Kesalahan"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
            {impErrors.slice(0, 20).map((e, i) => (
              <TableRow key={i}>
                <TableCell className="font-bold">{e.baris}</TableCell>
                <TableCell>{e.pesan}</TableCell>
              </TableRow>
            ))}
              </TableBody>
            </Table>
          </div>
        )}
        {impErrors.length > 20 && <Alert>…dan {impErrors.length - 20} kesalahan lain.</Alert>}
      </Card>
      <Card className="mt-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Hari Libur Sekolah</h2>
        <Alert>Tambah rentang tanggal libur sekaligus untuk semua kelas, satu tingkatan, atau satu kelas. Saat hari libur, absensi otomatis nonaktif (rekap kosong, scan/input ditolak).</Alert>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <label className="grid gap-[6px] text-[13px] text-muted">
            Dari:
            <Input className="w-auto" type="date" value={liburDari} onChange={(e) => setLiburDari(e.target.value)} />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Sampai:
            <Input className="w-auto" type="date" value={liburSampai} onChange={(e) => setLiburSampai(e.target.value)} />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Berlaku untuk:
            <Select value={liburScope} onValueChange={(v) => { setLiburScope(v ?? "semua"); setLiburRefresh((r) => r + 1); }}>
              <SelectTrigger className="min-w-[180px]"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
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
          <label className="grid gap-[6px] text-[13px] text-muted">
            Keterangan:
            <Input className="min-w-[180px]" placeholder="mis. Libur semester" value={liburNote} onChange={(e) => setLiburNote(e.target.value)} />
          </label>
          <div className="flex items-end">
            <Button variant="sticker" onClick={tambahLibur}>Tambah Libur</Button>
          </div>
        </div>
        {liburMsg && <Alert>{liburMsg}</Alert>}
        <DataTable<LiburRow>
          columns={liburColumns}
          rows={liburData?.rows ?? []}
          getRowId={(l) => l.id}
          bulkActions={[
            { label: "Hapus terpilih", danger: true, onClick: (ids) => hapusLiburBulk(ids) },
          ]}
          emptyText="Belum ada hari libur mendatang untuk cakupan ini."
        />
      </Card>
      <Dialog open={edit !== null} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent aria-label="Edit slot jadwal">
          <DialogHeader>
            <DialogTitle>Edit slot</DialogTitle>
          </DialogHeader>
          {edit && (
          <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <Select value={edit.day} onValueChange={(v) => setEdit({ ...edit, day: v ?? "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {DAY_FULL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectPopup></SelectPositioner>
              </Select>
              <Input className="w-auto" type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />
              <Input className="w-auto" type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
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
            </div>
            {editMsg && <Alert variant="destructive">{editMsg}</Alert>}
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
