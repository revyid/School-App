"use client";

// Kartu QR siswa (statis): token + nama + kelas. Guru/siswa bisa cetak.
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err, Btn } from "@/components/DashUI";

export default function KartuQrPage() {
  const { data, loading, error } = useFetch<{
    qr: { token: string; version: number; student: { name: string; nisn: string | null; className: string | null } };
  }>("/api/attendance/qr");

  return (
    <>
      <PageHead kicker="Kehadiran" title="Kartu QR saya" desc="Tunjukkan kode ini ke guru untuk discan saat tiba di sekolah." />
      {loading && <Note>Memuat…</Note>}
      {error && <Err>Gagal: {error}</Err>}
      {data && (
        <Panel style={{ maxWidth: 360, textAlign: "center" }}>
          <p className="display" style={{ fontSize: 22, margin: "0 0 4px" }}>{data.qr.student.name}</p>
          <p style={{ color: "#74746d", fontSize: 13, margin: "0 0 14px" }}>
            NISN: {data.qr.student.nisn ?? "-"} · Kelas: {data.qr.student.className ?? "-"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/attendance/qr/png" alt="QR kehadiran" width={256} height={256} style={{ borderRadius: 16, border: "1px solid rgba(23,23,22,.14)" }} />
          <div style={{ marginTop: 14 }}>
            <Btn kind="dark" type="button" onClick={() => window.print()}>Cetak kartu</Btn>
          </div>
        </Panel>
      )}
    </>
  );
}
