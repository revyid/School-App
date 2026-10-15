"use client";

// Kartu QR kehadiran siswa — dipakai di halaman Profil (pengganti /siswa/kartu).
import { useFetch } from "@/app/lib/api";
import { Panel, Note, Err } from "@/components/DashUI";
import { Button } from "@/components/ui/button";

export default function KartuSection() {
  const { data, loading, error } = useFetch<{
    qr: { token: string; version: number; student: { name: string; nisn: string | null; className: string | null } };
  }>("/api/attendance/qr");

  return (
    <Panel style={{ maxWidth: 520, textAlign: "center" }}>
      <h2 className="display" style={{ fontSize: 18, margin: "0 0 4px" }}>Kartu QR saya</h2>
      <p style={{ color: "#74746d", fontSize: 13, margin: "0 0 14px" }}>
        Tunjukkan kode ini ke guru untuk discan saat tiba di sekolah.
      </p>
      {loading && <Note>Memuat…</Note>}
      {error && <Err>Gagal: {error}</Err>}
      {data && (
        <>
          <p className="display" style={{ fontSize: 22, margin: "0 0 4px" }}>{data.qr.student.name}</p>
          <p style={{ color: "#74746d", fontSize: 13, margin: "0 0 14px" }}>
            NISN: {data.qr.student.nisn ?? "-"} · Kelas: {data.qr.student.className ?? "-"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/attendance/qr/png" alt="QR kehadiran" width={256} height={256} style={{ borderRadius: 16, border: "1px solid rgba(23,23,22,.14)", maxWidth: "100%", height: "auto" }} />
          <div style={{ marginTop: 14 }}>
            <Button variant="sticker" style={{ background: "#171716", color: "#fffdf8" }} type="button" onClick={() => window.print()}>Cetak kartu</Button>
          </div>
        </>
      )}
    </Panel>
  );
}
