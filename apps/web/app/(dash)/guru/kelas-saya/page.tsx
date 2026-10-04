"use client";

import { useFetch } from "@/app/lib/api";

export default function GuruHome() {
  const { data } = useFetch<{ rows: { id: string; class: { name: string }; subject: string | null }[] }>(`/api/assignments`);
  return (
    <main>
      <h1>Dasbor Guru</h1>
      <h2>Kelas yang diampu</h2>
      {!data && <p>Memuat…</p>}
      {data && (
        <ul>
          {data.rows.map((r) => (
            <li key={r.id}>{r.class.name}{r.subject ? ` — ${r.subject}` : ""}</li>
          ))}
        </ul>
      )}
      {data && data.rows.length === 0 && <p>Belum ada penugasan. Hubungi admin.</p>}
      <p><a href="/change-password">Ganti kata sandi</a></p>
    </main>
  );
}
