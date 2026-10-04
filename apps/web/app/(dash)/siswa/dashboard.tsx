"use client";

// Dasbor siswa: kartu profil + progres tugas + ringkasan absensi 30 hari terakhir.
import { useFetch } from "@/app/lib/api";

export default function SiswaDashboard() {
  const profile = useFetch<{
    user: { name: string; nisn: string | null; studentProfile: { bio: string | null; class: { name: string } | null } | null };
  }>("/api/profile");
  const tasks = useFetch<{ rows: { id: string; state: string }[] }>("/api/tasks?status=semua");

  const rows = tasks.data?.rows ?? [];
  const belum = rows.filter((t) => t.state === "BELUM").length;
  const terlambat = rows.filter((t) => t.state === "TERLAMBAT" || t.state === "TUTUP").length;
  const sudah = rows.filter((t) => t.state === "SUDAH").length;
  const pct = rows.length === 0 ? 0 : Math.round((sudah / rows.length) * 100);

  return (
    <div>
      {profile.data && (
        <div>
          <p>Nama: {profile.data.user.name}</p>
          <p>Kelas: {profile.data.user.studentProfile?.class?.name ?? "-"}</p>
          <p>NISN: {profile.data.user.nisn ?? "-"}</p>
        </div>
      )}
      <p>
        Progres tugas: {sudah}/{rows.length} ({pct}%)
      </p>
      <progress value={pct} max={100} style={{ width: "100%" }} />
      <p>Belum dikumpulkan: {belum} · Terlambat/tutup: {terlambat}</p>
      <p>
        <a href="/siswa/tugas">Tugas saya</a> · <a href="/siswa/kartu">Kartu QR</a> ·{" "}
        <a href="/siswa/profil">Profil</a>
      </p>
    </div>
  );
}
