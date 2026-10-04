"use client";

import { useFetch } from "@/app/lib/api";

export default function SiswaHome() {
  const { data } = useFetch<{ user: { name: string; nisn: string | null; studentProfile: { bio: string | null; class: { name: string } | null } | null } }>(`/api/profile`);
  return (
    <main>
      <h1>Dasbor Siswa</h1>
      {!data && <p>Memuat…</p>}
      {data && (
        <div>
          <p>Nama: {data.user.name}</p>
          <p>NISN: {data.user.nisn ?? "-"}</p>
          <p>Kelas: {data.user.studentProfile?.class?.name ?? "-"}</p>
          {data.user.studentProfile?.bio && <p>Bio: {data.user.studentProfile.bio}</p>}
        </div>
      )}
      <p><a href="/change-password">Ganti kata sandi</a></p>
    </main>
  );
}
