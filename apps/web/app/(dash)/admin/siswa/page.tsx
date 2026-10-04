"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";

interface StudentRow {
  userId: string;
  classId: string | null;
  parentPhone: string | null;
  gender: string | null;
  user: { id: string; name: string; nisn: string | null; email: string | null; isActive: boolean };
  class: { id: string; name: string } | null;
}

export default function StudentsPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  const qs = new URLSearchParams({ page: String(page), perPage: "20", q: debounced, ...(classId ? { classId } : {}) });
  const { data, loading, error, reload } = useFetch<{ rows: StudentRow[]; total: number; page: number; perPage: number }>(
    `/api/students?${qs}`,
  );
  const { data: classes } = useFetch<{ rows: { id: string; name: string }[] }>(`/api/classes?page=1&perPage=100`);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  async function toggleActive(row: StudentRow) {
    if (!confirm(`${row.user.isActive ? "Nonaktifkan" : "Aktifkan"} ${row.user.name}?`)) return;
    const res = await api(`/api/students/${row.userId}`, {
      method: "PATCH",
      csrf: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.user.isActive }),
    });
    if (!res.ok) alert("Gagal: " + ((await res.json().catch(() => ({}))).error || res.status));
    reload();
  }

  return (
    <main>
      <h1>Daftar Siswa</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="Cari nama / NISN" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }}>
          <option value="">Semua kelas</option>
          {classes?.rows.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <a href="/admin/import">Import Excel</a>
      </div>
      {loading && <p>Memuat…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {data && (
        <>
          <p>Total {data.total} siswa</p>
          <table>
            <thead><tr><th>Nama</th><th>NISN</th><th>Kelas</th><th>No Ortu</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.userId}>
                  <td>{r.user.name}</td>
                  <td>{r.user.nisn ?? "-"}</td>
                  <td>{r.class?.name ?? "-"}</td>
                  <td>{r.parentPhone ?? "-"}</td>
                  <td>{r.user.isActive ? "Aktif" : "Nonaktif"}</td>
                  <td><button onClick={() => toggleActive(r)}>{r.user.isActive ? "Nonaktifkan" : "Aktifkan"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
            <span>Halaman {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
          </div>
        </>
      )}
    </main>
  );
}
