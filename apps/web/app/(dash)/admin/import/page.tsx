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
