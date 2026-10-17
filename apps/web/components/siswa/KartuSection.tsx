"use client";

// Kartu QR kehadiran siswa — dipakai di halaman Profil (pengganti /siswa/kartu).
import { useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function KartuSection() {
  const { data, loading, error } = useFetch<{
    qr: { token: string; version: number; student: { name: string; nisn: string | null; className: string | null } };
  }>("/api/attendance/qr");

  return (
    <Card className="max-w-[520px] text-center">
      <h2 className="display text-[18px] mt-0 mr-0 mb-1 ml-0">Kartu QR saya</h2>
      <p className="text-muted text-[13px] mt-0 mr-0 mb-[14px] ml-0">
        Tunjukkan kode ini ke guru untuk discan saat tiba di sekolah.
      </p>
      {loading && <Alert>Memuat…</Alert>}
      {error && <Alert variant="destructive">Gagal: {error}</Alert>}
      {data && (
        <>
          <p className="display text-[22px] mt-0 mr-0 mb-1 ml-0">{data.qr.student.name}</p>
          <p className="text-muted text-[13px] mt-0 mr-0 mb-[14px] ml-0">
            NISN: {data.qr.student.nisn ?? "-"} · Kelas: {data.qr.student.className ?? "-"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rounded-2xl border border-solid border-line max-w-full h-auto" src="/api/attendance/qr/png" alt="QR kehadiran" width={256} height={256} />
          <div className="mt-[14px]">
            <Button className="bg-ink text-cream" variant="sticker"  type="button" onClick={() => window.print()}>Cetak kartu</Button>
          </div>
        </>
      )}
    </Card>
  );
}
