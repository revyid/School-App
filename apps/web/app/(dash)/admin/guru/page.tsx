"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, WarmTable, warmCell, Note, Err, LinkBtn } from "@/components/DashUI";

export default function TeachersPage() {
  const { data, loading, error, reload } = useFetch<{ rows: { id: string; name: string; email: string | null; nisn: string | null; isActive: boolean }[]; total: number }>(`/api/teachers?page=1&perPage=100`);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastPw, setLastPw] = useState<string | null>(null);

  async function create() {
    const res = await api("/api/teachers", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setLastPw(d.tempPassword);
    setName(""); setEmail("");
    reload();
  }

  async function resetPw(id: string, n: string) {
    if (!confirm(`Reset password ${n}?`)) return;
    const res = await api(`/api/teachers/${id}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert("Gagal: " + (d.error || res.status)); return; }
    setLastPw(d.tempPassword);
  }

  async function toggle(id: string, active: boolean, n: string) {
    if (!confirm(`${active ? "Nonaktifkan" : "Aktifkan"} ${n}?`)) return;
    await api(`/api/teachers/${id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !active }),
    });
    reload();
  }

  return (
    <>
      <PageHead
        kicker="Data master"
        title="Guru"
        desc="Tambah guru baru (dapat password sementara sekali tampil) dan kelola statusnya."
        right={<LinkBtn href="/admin/penugasan">Penugasan guru-kelas</LinkBtn>}
      />
      {lastPw && <p style={{ background: "#f5c94a", padding: "10px 14px", borderRadius: 14, fontWeight: 700 }}>Password sementara (tampilkan sekali): {lastPw}</p>}
      <Panel style={{ marginBottom: 16 }}>
        {loading && <Note>Memuat…</Note>}
        {error && <Err>Error: {error}</Err>}
        {data && data.rows.length === 0 && <Note>Belum ada guru. Tambahkan di bawah.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Nama", "Email", "NISN", "Status", "Aksi"]}>
            {data.rows.map((t) => (
              <tr key={t.id}>
                <td style={warmCell({ fontWeight: 700 })}>{t.name}</td>
                <td style={warmCell()}>{t.email ?? "-"}</td>
                <td style={warmCell()}>{t.nisn ?? "-"}</td>
                <td style={warmCell()}><Badge status={t.isActive ? "AKTIF" : "NONAKTIF"}>{t.isActive ? "Aktif" : "Nonaktif"}</Badge></td>
                <td style={warmCell()}>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Btn kind="ghost" onClick={() => resetPw(t.id, t.name)}>Reset PW</Btn>
                    <Btn kind="ghost" onClick={() => toggle(t.id, t.isActive, t.name)}>{t.isActive ? "Nonaktif" : "Aktif"}</Btn>
                  </span>
                </td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Tambah guru</h2>
        <Toolbar>
          <TextInput placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 220 }} />
          <TextInput placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: 260 }} />
          <Btn onClick={create}>Tambah</Btn>
        </Toolbar>
      </Panel>
    </>
  );
}
