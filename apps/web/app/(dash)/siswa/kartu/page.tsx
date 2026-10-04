"use client";

// Kartu QR siswa (statis): token + nama + kelas. Guru/siswa bisa cetak.
import { useFetch } from "@/app/lib/api";

export default function KartuQrPage() {
  const { data, loading, error } = useFetch<{
    qr: { token: string; version: number; student: { name: string; nisn: string | null; className: string | null } };
  }>("/api/attendance/qr");

  return (
    <main>
      <h1>Kartu QR Saya</h1>
      {loading && <p>Memuat…</p>}
      {error && <p>Gagal: {error}</p>}
      {data && (
        <div style={{ border: "1px solid #000", padding: 16, maxWidth: 320 }}>
          <p><b>{data.qr.student.name}</b></p>
          <p>NISN: {data.qr.student.nisn ?? "-"}</p>
          <p>Kelas: {data.qr.student.className ?? "-"}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/attendance/qr/png" alt="QR kehadiran" width={256} height={256} />
          <p>Tunjukkan kode ini ke guru untuk discan.</p>
          <button type="button" onClick={() => window.print()}>Cetak</button>
        </div>
      )}
    </main>
  );
}
