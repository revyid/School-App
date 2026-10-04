"use client";

// Admin: flag persetujuan ortu + teks kebijakan privasi.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function PrivasiAdminPage() {
  const [studentId, setStudentId] = useState("");
  const consent = useFetch<{ consent: { studentId: string; consented: boolean } }>(
    studentId ? `/api/consent?studentId=${studentId}` : null,
  );
  const policy = useFetch<{ policy: { text: string } | null }>("/api/policy");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function tandai(consented: boolean) {
    const res = await api("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, consented }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(consented ? "Ditandai disetujui" : "Ditandai belum disetujui");
      consent.reload();
    }
  }

  async function simpanPolicy(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/policy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Kebijakan tersimpan");
      policy.reload();
    }
  }

  return (
    <main>
      <h1>Privasi & Persetujuan Ortu</h1>
      <h2>Flag persetujuan</h2>
      <label>ID siswa: <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="userId siswa" /></label>
      {consent.data && (
        <p>
          Status: {consent.data.consent.consented ? "Disetujui" : "Belum"}
          <button type="button" onClick={() => tandai(true)}>Tandai setuju</button>
          <button type="button" onClick={() => tandai(false)}>Tandai belum</button>
        </p>
      )}
      <h2>Kebijakan privasi sekolah</h2>
      {policy.data?.policy && <p>Saat ini: {policy.data.policy.text.slice(0, 200)}…</p>}
      <form onSubmit={simpanPolicy}>
        <label>Teks kebijakan: <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} /></label>
        <button type="submit">Simpan</button>
      </form>
      {msg && <p>{msg}</p>}
    </main>
  );
}
