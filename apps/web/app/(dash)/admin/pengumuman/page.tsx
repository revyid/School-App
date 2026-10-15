"use client";

// Admin: pengumuman CRUD-minimal (buat + daftar) + reveal thread anonim + atur expRules.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, WarmTable, warmCell, Note } from "@/components/DashUI";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";

export default function PengumumanAdminPage() {
  const { data, reload } = useFetch<{ rows: { id: string; title: string; target: string }[] }>("/api/announcements");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("ALL");
  const [msg, setMsg] = useState<string | null>(null);

  async function buat(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/announcements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, target }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Pengumuman terbit");
      setTitle("");
      setBody("");
      reload();
    }
  }

  return (
    <>
      <PageHead kicker="Komunikasi" title="Pengumuman" desc="Terbitkan info resmi untuk guru, siswa, atau semua warga sekolah." />
      <Panel style={{ marginBottom: 16 }}>
        <form onSubmit={buat} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Judul:
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Isi:
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Target:
            <Select value={target} onValueChange={(v) => setTarget(v ?? "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="ALL">Semua</SelectItem>
                <SelectItem value="GURU">Guru saja</SelectItem>
                <SelectItem value="SISWA">Siswa saja</SelectItem>
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          <Toolbar><Button variant="sticker" type="submit">Terbitkan</Button></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Sudah terbit</h2>
        {!data && <Note>Memuat…</Note>}
        {data && data.rows.length === 0 && <Note>Belum ada pengumuman.</Note>}
        {data && data.rows.length > 0 && (
          <WarmTable head={["Judul", "Target"]}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td style={warmCell({ fontWeight: 700 })}>{r.title}</td>
                <td style={warmCell()}><Badge variant={statusVariant(r.target === "ALL" ? "AKTIF" : "IZIN")}>{r.target}</Badge></td>
              </tr>
            ))}
          </WarmTable>
        )}
      </Panel>
    </>
  );
}
