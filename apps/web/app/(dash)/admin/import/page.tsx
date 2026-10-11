"use client";

import { useRef, useState } from "react";
import { api } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, Btn, Badge, SegStat, Note, LinkBtn } from "@/components/DashUI";

interface BatchStatus {
  batch: {
    id: string; fileName: string; status: string; totalRows: number;
    processedRows: number; okRows: number; errRows: number;
  };
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<BatchStatus["batch"] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function upload() {
    const f = fileRef.current?.files?.[0];
    if (!f) { setMsg("Pilih file .xlsx dulu"); return; }
    setMsg("Mengunggah…");
    const form = new FormData();
    form.append("file", f);
    const res = await api("/api/students/import", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg("Gagal: " + (d.error || res.status)); return; }
    setBatchId(d.batchId);
    setMsg("Batch dibuat, memproses…");
    poll(d.batchId);
  }

  async function poll(id: string) {
    const res = await fetch(`/api/students/import/${id}`, { cache: "no-store" });
    const d: BatchStatus = await res.json().catch(() => ({} as BatchStatus));
    if (d.batch) {
      setStatus(d.batch);
      if (d.batch.status === "PENDING" || d.batch.status === "PROCESSING") {
        setTimeout(() => poll(id), 2000);
      } else {
        setMsg(d.batch.status === "DONE" ? "Selesai" : `Status: ${d.batch.status}`);
      }
    }
  }

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Import siswa dari Excel"
        desc="Kolom: Nama | JK | NISN | Tgl Lahir | Kelas | No Ortu. Maks 10MB, format .xlsx."
        right={<LinkBtn href="/admin/siswa">Kembali ke daftar siswa</LinkBtn>}
      />
      <Panel style={{ maxWidth: 640, marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 16, margin: "0 0 8px" }}>Contoh format Excel</h2>
        <Note>Header persis: Nama | JK (L/P) | NISN | Tgl Lahir (YYYY-MM-DD) | Kelas | No Ortu. Maks 10MB, format .xlsx.</Note>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
          <thead>
            <tr style={{ background: "#eeeadd" }}>
              {["Nama", "JK", "NISN", "Tgl Lahir", "Kelas", "No Ortu"].map((h) => (
                <th key={h} style={{ border: "1px solid rgba(23,23,22,.2)", padding: "6px 8px", textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>{["Siti Aminah", "P", "1000000001", "2015-03-12", "1A", "6281234567890"].map((c, i) => (
              <td key={i} style={{ border: "1px solid rgba(23,23,22,.15)", padding: "6px 8px" }}>{c}</td>
            ))}</tr>
            <tr>{["Budi Santoso", "L", "1000000002", "2015-07-25", "1A", "6289876543210"].map((c, i) => (
              <td key={i} style={{ border: "1px solid rgba(23,23,22,.15)", padding: "6px 8px" }}>{c}</td>
            ))}</tr>
          </tbody>
        </table>
        <Toolbar>
          <LinkBtn href="/api/students/import/template">Unduh contoh .xlsx</LinkBtn>
        </Toolbar>
      </Panel>
      <Panel style={{ maxWidth: 640 }}>
        <Toolbar>
          <input ref={fileRef} type="file" accept=".xlsx" />
          <Btn onClick={upload}>Upload dan proses</Btn>
        </Toolbar>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        {status && (
          <>
            <SegStat stats={[
              { label: "Diproses", value: `${status.processedRows}/${status.totalRows}` },
              { label: "Berhasil", value: status.okRows },
              { label: "Gagal", value: status.errRows },
            ]} />
            <p>Status batch: <Badge status={status.status === "DONE" ? "AKTIF" : "PENDING"}>{status.status}</Badge></p>
            {status.status === "DONE" && batchId && (
              <Toolbar>
                <LinkBtn href={`/api/students/import/${batchId}/errors`}>Unduh laporan error</LinkBtn>
                <LinkBtn kind="dark" href={`/api/students/import/${batchId}/credentials`}>Unduh kredensial (sekali saja)</LinkBtn>
              </Toolbar>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
