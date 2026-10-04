"use client";

import { useRef, useState } from "react";
import { api } from "@/app/lib/api";

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
    <main>
      <h1>Import Siswa dari Excel</h1>
      <p>Kolom: Nama | JK | NISN | Tgl Lahir | Kelas | No Ortu. Maks 10MB, format .xlsx.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <input ref={fileRef} type="file" accept=".xlsx" />
        <button onClick={upload}>Upload & Proses</button>
      </div>
      {msg && <p>{msg}</p>}
      {status && (
        <div>
          <p>Status: {status.status} — {status.processedRows}/{status.totalRows} baris, ok {status.okRows}, error {status.errRows}</p>
          {status.status === "DONE" && batchId && (
            <div style={{ display: "flex", gap: 8 }}>
              <a href={`/api/students/import/${batchId}/errors`}>Unduh laporan error</a>
              <a href={`/api/students/import/${batchId}/credentials`}>Unduh kredensial (sekali saja)</a>
            </div>
          )}
        </div>
      )}
      <p><a href="/admin/siswa">← Kembali ke daftar siswa</a></p>
    </main>
  );
}
