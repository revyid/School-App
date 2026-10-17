"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { type ColumnDef } from "@tanstack/react-table";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import UploadPopup from "@/components/UploadPopup";
import { DataTable, selectColumn, actionsColumn } from "@/components/ui/data-table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StudentRow {
  userId: string;
  classId: string | null;
  parentPhone: string | null;
  gender: string | null;
  user: {
    id: string;
    name: string;
    nisn: string | null;
    email: string | null;
    isActive: boolean;
  };
  class: { id: string; name: string } | null;
}

// Render kartu QR siswa ke Canvas -> PNG Blob
async function renderCardCanvas(
  card: { name: string; nisn: string; className: string; qrToken: string },
  schoolName: string
): Promise<Blob> {
  const qrDataUrl = await QRCode.toDataURL(card.qrToken, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  const qrImg = new Image();
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
    qrImg.src = qrDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 860;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, 600, 860);

  // Border frame luar
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, 568, 828);

  // Border frame dalam
  ctx.strokeStyle = "rgba(23,23,22,0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, 548, 808);

  // Header banner oranye
  ctx.fillStyle = "#e85e43";
  ctx.fillRect(28, 28, 544, 95);

  // Nama Sekolah & Judul
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(schoolName.toUpperCase(), 300, 70);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("KARTU IDENTITAS & PRESENSI SISWA", 300, 98);

  // Box putih tempat QR Code
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 3;
  ctx.fillRect(140, 150, 320, 320);
  ctx.strokeRect(140, 150, 320, 320);

  // Gambar QR Code
  ctx.drawImage(qrImg, 150, 160, 300, 300);

  // Nama Siswa
  ctx.fillStyle = "#171716";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText(card.name, 300, 525);

  // Badge Kelas
  ctx.fillStyle = "#aec6a4";
  ctx.fillRect(180, 555, 240, 42);
  ctx.strokeStyle = "#171716";
  ctx.lineWidth = 2;
  ctx.strokeRect(180, 555, 240, 42);
  ctx.fillStyle = "#171716";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText(`KELAS: ${card.className}`, 300, 582);

  // Nomor NISN
  ctx.fillStyle = "#171716";
  ctx.font = "bold 20px monospace";
  ctx.fillText(`NISN: ${card.nisn}`, 300, 638);

  // Petunjuk
  ctx.fillStyle = "#74746d";
  ctx.font = "14px sans-serif";
  ctx.fillText("Pindai QR ini pada scanner guru/sekolah", 300, 715);
  ctx.fillText("untuk mencatat kehadiran otomatis.", 300, 738);

  // Footer
  ctx.fillStyle = "#f5c94a";
  ctx.fillRect(28, 775, 544, 45);
  ctx.fillStyle = "#171716";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("SMS-LMS • PRESENSI & PORTAL SISWA DIGITAL", 300, 803);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}

export default function SiswaManager() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams({
    page: String(page),
    perPage: "20",
    q: debounced,
    ...(classId ? { classId } : {}),
  });

  const { data, loading, error, reload } = useFetch<{
    rows: StudentRow[];
    total: number;
    page: number;
    perPage: number;
  }>(`/api/students?${qs}`);

  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(
    `/api/classes?page=1&perPage=100`
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  const columns: ColumnDef<StudentRow, unknown>[] = useMemo(() => [
    selectColumn<StudentRow>(),
    {
      accessorKey: "user.name",
      header: "Nama Siswa",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="font-bold">
            {r.user.name}
            <div className="font-normal text-xs text-muted">NISN: {r.user.nisn ?? "-"}</div>
          </span>
        );
      },
    },
    {
      id: "kelas",
      header: "Kelas",
      cell: ({ row }) => row.original.class?.name ?? "-",
    },
    {
      accessorKey: "parentPhone",
      header: "No Ortu",
      cell: ({ row }) => row.original.parentPhone ?? "-",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.user.isActive ? "AKTIF" : "NONAKTIF")}>
          {row.original.user.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    actionsColumn<StudentRow>((r) => [
      { label: "Unduh QR (PNG)", onClick: () => downloadSingleCard(r) },
      { label: "Edit", onClick: () => startEdit(r) },
      { label: "Reset password", onClick: () => resetPw(r) },
      { label: r.user.isActive ? "Nonaktifkan" : "Aktifkan", onClick: () => toggleActive(r) },
    ]),
  ], [downloadSingleCard, startEdit, resetPw, toggleActive]);

  // Form Tambah Siswa Baru
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNisn, setNewNisn] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGender, setNewGender] = useState<"L" | "P">("L");
  const [createdPw, setCreatedPw] = useState<{ name: string; pw: string } | null>(null);
  const [submittingStudent, setSubmittingStudent] = useState(false);

  // Edit Siswa
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Download ZIP state
  const [zipLoading, setZipLoading] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  const { data: settingsData } = useFetch<{ settings: { portalName?: string } }>(`/api/settings`);
  const schoolName = settingsData?.settings?.portalName || "Sekolah";
  const [pending, setPending] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);

  // Import Excel state (preview -> proses -> progress)
  const [impFile, setImpFile] = useState<File | null>(null);
  const [impPreview, setImpPreview] = useState<{ cols: string[]; rows: string[][]; total: number } | null>(null);
  const [impMsg, setImpMsg] = useState<string | null>(null);
  const [impBatch, setImpBatch] = useState<{ id: string; status: string; totalRows: number; processedRows: number; okRows: number; errRows: number } | null>(null);

  async function previewImport(f: File) {
    setImpFile(f); setImpPreview(null); setImpBatch(null);
    if (!/\.xlsx$/i.test(f.name)) { setImpMsg("File harus .xlsx"); return; }
    setImpMsg(`File: ${f.name} (${(f.size / 1024).toFixed(1)} KB) — membaca…`);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
      const head = (aoa[0] ?? []).map(String);
      setImpPreview({ cols: head, rows: aoa.slice(1, 6).map((r) => r.map(String)), total: Math.max(0, aoa.length - 1) });
      setImpMsg(`Preview: ${aoa.length - 1} baris, ${head.length} kolom. Klik "Proses" untuk upload.`);
    } catch { setImpMsg("Gagal membaca .xlsx"); }
  }

  async function uploadImport() {
    if (!impFile) { setImpMsg("Pilih file .xlsx dulu"); return; }
    setImpMsg("Mengunggah…");
    const form = new FormData();
    form.append("file", impFile);
    const res = await api("/api/students/import", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setImpMsg("Gagal: " + (d.error || res.status)); return; }
    setImpMsg("Batch dibuat, memproses…");
    pollImport(d.batchId);
  }

  async function pollImport(id: string) {
    const res = await fetch(`/api/students/import/${id}`, { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (d.batch) {
      setImpBatch({ id, ...d.batch });
      if (d.batch.status === "PENDING" || d.batch.status === "PROCESSING") setTimeout(() => pollImport(id), 2000);
      else setImpMsg(d.batch.status === "DONE" ? "Selesai" : `Status: ${d.batch.status}`);
    }
  }

  function askConfirm(title: string, message: string, action: () => Promise<void>) {
    setPending({ title, message, action });
  }

  async function runPending() {
    if (!pending) return;
    const act = pending.action;
    setPending(null);
    await act();
  }

  async function createSingleStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newNisn.trim()) {
      alert("Nama lengkap dan NISN wajib diisi");
      return;
    }
    setSubmittingStudent(true);
    try {
      const res = await api("/api/students/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          nisn: newNisn.trim(),
          classId: newClassId || null,
          parentPhone: newPhone.trim() || null,
          gender: newGender || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Gagal menambah siswa: " + (d.error || res.status));
        return;
      }
      setCreatedPw({ name: newName.trim(), pw: d.tempPassword });
      setNewName("");
      setNewNisn("");
      setNewPhone("");
      reload();
    } finally {
      setSubmittingStudent(false);
    }
  }

  function startEdit(row: StudentRow) {
    setEditing(row);
    setEditName(row.user.name);
    setEditClass(row.classId ?? "");
    setEditPhone(row.parentPhone ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    const res = await api(`/api/students/${editing.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        classId: editClass || null,
        parentPhone: editPhone.trim() || null,
      }),
    });
    if (!res.ok) {
      alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
      return;
    }
    setEditing(null);
    reload();
  }

  async function toggleActive(row: StudentRow) {
    const r = row;
    askConfirm(r.user.isActive ? "Nonaktifkan Siswa" : "Aktifkan Siswa", `${r.user.isActive ? "Nonaktifkan" : "Aktifkan"} ${r.user.name}?`, async () => {
      const res = await api(`/api/students/${r.userId}`, {
        method: "PATCH",
        csrf: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !r.user.isActive }),
      });
      if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
      reload();
    });
  }

  async function resetPw(row: StudentRow) {
    const r = row;
    askConfirm("Reset Password", `Reset password ${r.user.name}?`, async () => {
      const res = await api(`/api/students/${r.userId}/reset-password`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Gagal reset password: " + (d.error || res.status));
        return;
      }
      setCreatedPw({ name: r.user.name, pw: d.tempPassword });
    });
  }

  async function setAktifBulk(ids: string[], aktif: boolean) {
    if (ids.length === 0) return;
    const label = aktif ? "Aktifkan" : "Nonaktifkan";
    askConfirm(`${label} Siswa`, `${label} ${ids.length} siswa terpilih?`, async () => {
      for (const id of ids) {
        await api(`/api/students/${id}`, {
          method: "PATCH",
          csrf: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: aktif }),
        });
      }
      reload();
    });
  }

  // Unduh 1 Kartu QR sebagai PNG
  async function downloadSingleCard(r: StudentRow) {
    try {
      const qrRes = await api(`/api/attendance/qr?studentId=${r.userId}`);
      const qrData = await qrRes.json();
      if (!qrRes.ok || !qrData?.qr?.token) {
        alert("Gagal memuat token QR siswa");
        return;
      }
      const blob = await renderCardCanvas(
        {
          name: r.user.name,
          nisn: r.user.nisn ?? "-",
          className: r.class?.name ?? "Umum",
          qrToken: qrData.qr.token,
        },
        schoolName
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Kartu_QR_${r.user.nisn ?? "siswa"}_${r.user.name}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal mengunduh kartu: " + (e as Error).message);
    }
  }

  // Unduh Semua Kartu QR sebagai file .ZIP
  async function downloadAllCardsZip() {
    setZipLoading(true);
    setZipProgress("Mengambil data kartu siswa…");
    try {
      const url = `/api/students/qr-cards${classId ? `?classId=${classId}` : ""}`;
      const res = await api(url);
      const data = await res.json();
      const rows = data.rows ?? [];
      if (rows.length === 0) {
        alert("Tidak ada data siswa untuk diunduh.");
        return;
      }

      const zip = new JSZip();
      for (let i = 0; i < rows.length; i++) {
        setZipProgress(`Merender kartu ${i + 1} dari ${rows.length}…`);
        const item = rows[i];
        const blob = await renderCardCanvas(item, data.schoolName || "Sekolah");
        const safeName = item.name.replace(/[^a-zA-Z0-9_-]/g, "_");
        zip.file(`${item.className}_${item.nisn}_${safeName}.png`, blob);
      }

      setZipProgress("Mengemas ke dalam file .ZIP…");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const dlUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const label = classId ? `Kelas_${classes?.rows.find((c) => c.id === classId)?.name ?? "Pilihan"}` : "Semua_Siswa";
      a.download = `Kartu_QR_Siswa_${label}.zip`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    } catch (err) {
      alert("Gagal mengunduh ZIP: " + (err as Error).message);
    } finally {
      setZipLoading(false);
      setZipProgress(null);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button variant="sticker" onClick={() => setShowAddForm(true)}>
          + Tambah Siswa
        </Button>
        <details className="relative">
          <summary className="btn-sticker btn-ghost cursor-pointer list-none">
            Unduh ▾
          </summary>
          <div className="absolute top-[calc(100%_+_8px)] left-[0px] z-[30] grid gap-2 min-w-[240px] bg-cream border-2 border-solid border-ink rounded-[14px] p-[10px]">
            <Button className="bg-olive-deep border-olive-deep text-cream w-full" variant="sticker"
              
              onClick={downloadAllCardsZip}
              disabled={zipLoading}
              
            >
              {zipLoading ? (zipProgress ?? "Memproses…") : "Kartu QR (.ZIP)"}
            </Button>
            <Button variant="sticker-ghost" onClick={() => document.getElementById("import-excel")?.scrollIntoView({ behavior: "smooth" })}>Import Excel</Button>
          </div>
        </details>
      </div>

      {/* Notifikasi password sementara setelah tambah siswa */}
      {createdPw && (
        <div className="bg-sun text-ink pt-[14px] pr-[18px] pb-[14px] pl-[18px] rounded-[14px] font-bold mb-4 border-2 border-solid border-ink flex justify-between items-center"
          
        >
          <div>
            Siswa <strong>{createdPw.name}</strong> berhasil didaftarkan! Password login sementara:{" "}
            <code className="bg-cream pt-[3px] pr-2 pb-[3px] pl-2 rounded-md text-base">
              {createdPw.pw}
            </code>
          </div>
          <Button variant="sticker-ghost" onClick={() => setCreatedPw(null)}>X</Button>
        </div>
      )}

      {/* Sheet Tambah Siswa Baru */}
      <Sheet open={showAddForm} onOpenChange={setShowAddForm}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Tambah Siswa</SheetTitle>
            <SheetDescription>Daftarkan satu siswa. Gunakan Import Excel untuk massal.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6">
          <form className="grid gap-[14px]" onSubmit={createSingleStudent}>
            <div className="grid gap-3">
              <label className="grid gap-[6px] text-[13px] text-muted">
                Nama Lengkap Siswa *:
                <Input
                  placeholder="Contoh: Muhammad Rizky"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-[6px] text-[13px] text-muted">
                NISN (Nomor Induk Siswa Nasional) *:
                <Input
                  placeholder="Contoh: 0012345678"
                  value={newNisn}
                  onChange={(e) => setNewNisn(e.target.value)}
                  required
                />
              </label>

              <label className="grid gap-[6px] text-[13px] text-muted">
                Kelas:
                <Select value={newClassId} onValueChange={(v) => setNewClassId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
                  <SelectPositioner><SelectPopup>
                    {classes?.rows.map((c) => (
                      <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                    ))}
                  </SelectPopup></SelectPositioner>
                </Select>
              </label>

              <label className="grid gap-[6px] text-[13px] text-muted">
                No HP WhatsApp Orang Tua (Opsional):
                <Input
                  placeholder="08123456789 atau 628..."
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </label>

              <label className="grid gap-[6px] text-[13px] text-muted">
                Jenis Kelamin:
                <Select value={newGender} onValueChange={(v) => setNewGender((v as "L" | "P") ?? "L")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectPositioner><SelectPopup>
                    <SelectItem value="L">Laki-laki (L)</SelectItem>
                    <SelectItem value="P">Perempuan (P)</SelectItem>
                  </SelectPopup></SelectPositioner>
                </Select>
              </label>

              <Button className="w-full min-h-[44px]" variant="sticker" type="submit" disabled={submittingStudent}>
                {submittingStudent ? "Mendaftarkan…" : "Daftarkan Siswa"}
              </Button>
            </div>
          </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tabel Siswa */}
      <Card className="mt-4">
        <DataTable<StudentRow>
          columns={columns}
          rows={data?.rows ?? []}
          getRowId={(r) => r.userId}
          searchValue={q}
          onSearchChange={(v) => { setQ(v); setPage(1); }}
          searchPlaceholder="Cari nama / NISN…"
          filters={(
            <label className="grid gap-[6px] text-[13px] text-muted">
              Kelas:
              <Select value={classId} onValueChange={(v) => { setClassId(v ?? ""); setPage(1); }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {classes?.rows.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
          )}
          bulkActions={[
            { label: "Aktifkan terpilih", onClick: (ids) => setAktifBulk(ids, true) },
            { label: "Nonaktifkan terpilih", onClick: (ids) => setAktifBulk(ids, false) },
          ]}
          emptyText="Tidak ada siswa yang cocok."
        />

            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <Button variant="sticker-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹ Sebelumnya
              </Button>
              <span className="text-[13px] text-muted">
                Halaman {page}/{totalPages}
              </span>
              <Button variant="sticker-ghost" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Berikutnya ›
              </Button>
            </div>
      </Card>

      {/* Import Excel */}
      <div className="scroll-mt-[80px]" id="import-excel">
      <Card className="mt-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-2 ml-0">Import Excel</h2>
        <Alert>Header persis: Nama | JK (L/P) | NISN | Tgl Lahir (YYYY-MM-DD) | Kelas | No Ortu. Maks 10MB, format .xlsx. <a href="/api/students/import/template">Unduh contoh .xlsx</a></Alert>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <div className="flex-[1_1_280px] min-w-[240px]">
            <UploadPopup label="Pilih file .xlsx" hint="Maks 10MB · format .xlsx" maxMb={10} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onFile={(f) => { if (f) previewImport(f); }} />
          </div>
          <Button variant="sticker" onClick={uploadImport} disabled={!impPreview}>Proses</Button>
        </div>
        {impMsg && <p className="font-bold">{impMsg}</p>}
        {impPreview && (
          <Table className="w-full border-collapse text-[12.5px] mt-2">
            <TableHeader><TableRow className="bg-paper-deep">{impPreview.cols.map((h, i) => (
              <TableHead className="border border-solid border-line pt-1.5 pr-2 pb-1.5 pl-2 text-left" key={i}>{h}</TableHead>
            ))}</TableRow></TableHeader>
            <TableBody>{impPreview.rows.map((r, i) => (
              <TableRow key={i}>{impPreview.cols.map((_, j) => (
                <TableCell className="border border-solid border-line pt-1.5 pr-2 pb-1.5 pl-2" key={j}>{r[j] ?? ""}</TableCell>
              ))}</TableRow>
            ))}</TableBody>
          </Table>
        )}
        {impBatch && (
          <p>Status: {impBatch.processedRows}/{impBatch.totalRows} diproses, {impBatch.okRows} berhasil, {impBatch.errRows} gagal ({impBatch.status})
            {impBatch.status === "DONE" && (<> — <a href={`/api/students/import/${impBatch.id}/errors`}>Laporan error</a> · <a href={`/api/students/import/${impBatch.id}/credentials`}>Kredensial</a></>)}
          </p>
        )}
      </Card>
      </div>
      <Sheet open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <SheetContent side="right" className="p-0">
          <SheetHeader>
            <SheetTitle>Edit Siswa: {editing?.user.name}</SheetTitle>
            <SheetDescription>Ubah nama, kelas, dan nomor WhatsApp orang tua.</SheetDescription>
          </SheetHeader>
          {editing && (
          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            <label className="grid gap-[6px] text-[13px] text-muted">
              Nama Lengkap:
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Kelas:
              <Select value={editClass} onValueChange={(v) => setEditClass(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Tanpa kelas" /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  {classes?.rows.map((c) => (
                    <SelectItem key={c.id} value={c.id}>Kelas {c.name}</SelectItem>
                  ))}
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Nomor WhatsApp Ortu:
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="08... atau 628..."
              />
            </label>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <Button variant="sticker" onClick={saveEdit}>Simpan</Button>
              <Button variant="sticker-ghost" onClick={() => setEditing(null)}>
                Batal
              </Button>
            </div>
          </div>
          )}
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
