"use client";

import { useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, WarmTable, warmCell, Note, Err } from "@/components/DashUI";
import ConfirmDialog from "@/components/ConfirmDialog";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAY_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface SlotRow {
  id: string; dayOfWeek: number; startTime: string; endTime: string;
  subjectName: string | null; subjectId: string | null;
  subjectRef: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null; teacherId: string | null;
}

interface EditState {
  id: string; day: string; start: string; end: string; subjectId: string; teacherId: string;
}

export default function TimetablePage() {
  // Banner bila datang dari /admin/mapel (tanpa useSearchParams agar tak perlu Suspense).
  const [dari] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("dari") : null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const { data: teachers } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/teachers?page=1&perPage=200`);
  const [classId, setClassId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const { data, loading, error, reload } = useFetch<{ rows: SlotRow[] }>(
    classId ? `/api/timetable?classId=${classId}&r=${refresh}` : null,
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
  const [edit, setEdit] = useState<EditState | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [impErrors, setImpErrors] = useState<{ baris: number; pesan: string }[]>([]);

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
    const f = fileRef.current?.files?.[0];
    if (!f) { setImpMsg("Pilih file .xlsx dulu"); return; }
    if (!classId) { setImpMsg("Pilih kelas dulu"); return; }
    setImpMsg("Mengunggah…");
    setImpErrors([]);
    const form = new FormData();
    form.append("file", f);
    form.append("classId", classId);
    const res = await api("/api/timetable/import", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setImpMsg("Gagal: " + (d.error || res.status));
      setImpErrors(d.errors ?? []);
      return;
    }
    setImpMsg(`Import selesai: ${d.ok} ditambah, ${d.gagal} gagal`);
    setImpErrors(d.errors ?? []);
    if (fileRef.current) fileRef.current.value = "";
    bump();
  }

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
          <TextSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Pilih kelas</option>
            {classes?.rows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </TextSelect>
          {classId && (
            <>
              <a className="btn-sticker btn-ghost" style={{ textDecoration: "none" }} href={`/api/timetable/export?classId=${classId}`}>Unduh Excel</a>
              <a className="btn-sticker btn-ghost" style={{ textDecoration: "none" }} href="/api/timetable/template">Unduh template</a>
            </>
          )}
        </Toolbar>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
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
                    <Btn kind="ghost" onClick={() => openEdit(s)}>Edit</Btn>
                    <Btn kind="ghost" onClick={() => setDeleteTarget(s.id)}>Hapus</Btn>
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
              <TextSelect value={day} onChange={(e) => setDay(e.target.value)}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </TextSelect>
              <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "auto" }} />
              <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ width: "auto" }} />
              <TextSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Pilih mapel</option>
                {mapelOpts.map((s) => (
                  <option key={s.id ?? `nama:${s.name}`} value={s.id ?? ""}>
                    {s.name}{s.id ? "" : " (baru)"}
                  </option>
                ))}
              </TextSelect>
              <TextSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Pilih guru</option>
                {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </TextSelect>
              <Btn onClick={add}>Tambah</Btn>
            </Toolbar>
            <Note>Mapel kelas ini ({mapelKelas?.subjects.length ?? 0}) diambil dari jadwal; bila kelas belum punya slot, daftar global dipakai.</Note>
          </Panel>
          <Panel>
            <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Import dari Excel</h2>
            <Note>Format sendiri: Hari|Mulai|Selesai|Mapel|Guru (contoh Hari: Senin, Mulai/Selesai HH:MM). Maks 10MB. Nama mapel baru otomatis dibuat; guru tak dikenal dilaporkan per baris.</Note>
            <Toolbar>
              <input ref={fileRef} type="file" accept=".xlsx" />
              <Btn onClick={upload}>Upload</Btn>
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
        </>
      )}
      {edit && (
        <div role="dialog" aria-modal="true" aria-label="Edit slot jadwal" onClick={() => setEdit(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(23,23,22,.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "min(100%, 480px)", background: "#f7f4ec", color: "#171716", border: "2px solid #171716", borderRadius: 24, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 className="display" style={{ fontSize: 20, margin: 0 }}>Edit slot</h3>
            <Toolbar>
              <TextSelect value={edit.day} onChange={(e) => setEdit({ ...edit, day: e.target.value })}>
                {DAY_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </TextSelect>
              <TextInput type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} style={{ width: "auto" }} />
              <TextInput type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} style={{ width: "auto" }} />
            </Toolbar>
            <Toolbar>
              <TextSelect value={edit.subjectId} onChange={(e) => setEdit({ ...edit, subjectId: e.target.value })}>
                <option value="">Pilih mapel</option>
                {mapelOpts.map((s) => (
                  <option key={s.id ?? `nama:${s.name}`} value={s.id ?? ""}>{s.name}</option>
                ))}
              </TextSelect>
              <TextSelect value={edit.teacherId} onChange={(e) => setEdit({ ...edit, teacherId: e.target.value })}>
                <option value="">Pilih guru</option>
                {teachers?.rows.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </TextSelect>
            </Toolbar>
            {editMsg && <Err>{editMsg}</Err>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Btn kind="ghost" onClick={() => setEdit(null)}>Batal</Btn>
              <Btn onClick={saveEdit}>Simpan</Btn>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Hapus Slot Jadwal"
        message="Hapus slot jadwal ini?"
        confirmLabel="Ya, hapus"
        onConfirm={doRemove}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
