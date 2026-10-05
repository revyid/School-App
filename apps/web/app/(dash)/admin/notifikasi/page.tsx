"use client";

import { useState } from "react";
import { api } from "@/app/lib/api";
import { PageHead, Panel, TextInput, Btn, Note } from "@/components/DashUI";

export default function NotifikasiAdminPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetRole, setTargetRole] = useState<"ALL" | "SISWA" | "GURU">("ALL");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setMsg({ type: "err", text: "Judul dan isi pesan wajib diisi." });
      return;
    }
    setBusy(true);
    setMsg(null);

    try {
      const res = await api("/api/notifications/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, targetRole }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "err", text: d.error || "Gagal mengirim notifikasi." });
      } else {
        setMsg({ type: "ok", text: `Berhasil mengirim ke ${d.sentCount} pengguna!` });
        setTitle("");
        setBody("");
      }
    } catch {
      setMsg({ type: "err", text: "Koneksi bermasalah." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        kicker="Pemberitahuan"
        title="Kirim Notifikasi Broadcast"
        desc="Kirim pengumuman langsung ke lonceng notifikasi dan push browser seluruh civitas sekolah."
      />

      <Panel style={{ maxWidth: 640 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 16px" }}>Buat Pesan Notifikasi</h2>
        <form onSubmit={handleSend} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Target Penerima:
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as any)}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(23,23,22,.25)",
                background: "#fffdf8",
                padding: "9px 14px",
                fontSize: 14,
              }}
            >
              <option value="ALL">Semua Warga Sekolah (Guru & Siswa)</option>
              <option value="SISWA">Khusus Siswa Saja</option>
              <option value="GURU">Khusus Guru Saja</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Judul Notifikasi:
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pengumuman Ujian Tengah Semester"
              required
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Isi Pesan:
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Tuliskan detail pengumuman yang akan muncul di HP/Browser siswa & guru…"
              required
              style={{
                borderRadius: 14,
                border: "1px solid rgba(23,23,22,.25)",
                background: "#fffdf8",
                padding: "9px 14px",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />
          </label>

          <div style={{ marginTop: 6 }}>
            <Btn type="submit" disabled={busy}>
              {busy ? "Mengirim Notifikasi…" : "Kirim Sekarang 🚀"}
            </Btn>
          </div>
        </form>

        {msg && (
          <div style={{ marginTop: 16 }}>
            <Note>{msg.text}</Note>
          </div>
        )}
      </Panel>
    </>
  );
}
