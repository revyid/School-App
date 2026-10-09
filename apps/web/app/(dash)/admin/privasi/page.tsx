"use client";

// Admin: flag persetujuan ortu + teks kebijakan privasi.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextSelect, Btn, Badge, Note } from "@/components/DashUI";

export default function PrivasiAdminPage() {
  const [studentId, setStudentId] = useState("");
  const students = useFetch<{ rows: { user: { id: string; name: string; nisn: string | null }; class: { name: string } | null }[] }>("/api/students?perPage=100");
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
    <>
      <PageHead kicker="Kepatuhan" title="Privasi dan persetujuan ortu" desc="Catat persetujuan orang tua dan kelola teks kebijakan privasi sekolah." />
      <Panel style={{ marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Flag persetujuan</h2>
        <Toolbar>
          <TextSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— pilih siswa —</option>
            {(students.data?.rows ?? []).map((r) => (
              <option key={r.user.id} value={r.user.id}>
                {r.user.name}{r.user.nisn ? ` (${r.user.nisn})` : ""}{r.class ? ` — ${r.class.name}` : ""}
              </option>
            ))}
          </TextSelect>
        </Toolbar>
        {consent.data && (
          <p style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            Status: <Badge status={consent.data.consent.consented ? "AKTIF" : "PENDING"}>{consent.data.consent.consented ? "Disetujui" : "Belum"}</Badge>
            <Btn type="button" onClick={() => tandai(true)}>Tandai setuju</Btn>
            <Btn kind="ghost" type="button" onClick={() => tandai(false)}>Tandai belum</Btn>
          </p>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Kebijakan privasi sekolah</h2>
        {policy.data?.policy && <Note>Saat ini: {policy.data.policy.text.slice(0, 200)}…</Note>}
        <form onSubmit={simpanPolicy} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Teks kebijakan:
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <Toolbar><Btn type="submit">Simpan</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
    </>
  );
}
