"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, TextInput, Note } from "@/components/DashUI";
import { Button } from "@/components/ui/button";

interface KelasRow {
  id: string;
  name: string;
}

type PushTarget = "semua" | "guru" | "siswa" | "kelas";

const selectStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(23,23,22,.25)",
  background: "#fffdf8",
  padding: "10px 14px",
  fontSize: 14,
  width: "100%",
  minHeight: 44,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "#74746d",
};

export default function NotifikasiAdminPage() {
  const { data: kelasData } = useFetch<{ rows: KelasRow[] }>("/api/classes?perPage=100");
  const daftarKelas = kelasData?.rows ?? [];

  // --- Panel Push ---
  const [target, setTarget] = useState<PushTarget>("semua");
  const [pushKelas, setPushKelas] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handlePush(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setPushMsg({ type: "err", text: "Judul dan isi pesan wajib diisi." });
      return;
    }
    if (target === "kelas" && !pushKelas) {
      setPushMsg({ type: "err", text: "Pilih kelas dulu." });
      return;
    }
    setPushBusy(true);
    setPushMsg(null);
    try {
      const res = await api("/api/push/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          ...(target === "kelas" ? { classId: pushKelas } : {}),
          title,
          body,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushMsg({ type: "err", text: d.error || "Gagal mengirim push." });
      } else {
        setPushMsg({ type: "ok", text: `Push terkirim ke ${d.sent} perangkat, gagal ${d.failed}.` });
        setTitle("");
        setBody("");
      }
    } catch {
      setPushMsg({ type: "err", text: "Koneksi bermasalah." });
    } finally {
      setPushBusy(false);
    }
  }

  // --- Panel WA ---
  const [waKelas, setWaKelas] = useState("");
  const [template, setTemplate] = useState("");
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: "ok" | "err"; text: string; skipped?: { name: string; reason: string }[] } | null>(null);

  const preview = template.replaceAll("{nama}", "Budi");

  async function handleWa(e: React.FormEvent) {
    e.preventDefault();
    if (!waKelas) {
      setWaMsg({ type: "err", text: "Pilih kelas dulu." });
      return;
    }
    if (!template.trim()) {
      setWaMsg({ type: "err", text: "Template pesan wajib diisi." });
      return;
    }
    setWaBusy(true);
    setWaMsg(null);
    try {
      const res = await api("/api/wa/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId: waKelas, template }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWaMsg({ type: "err", text: d.error || "Gagal mengirim WA." });
      } else {
        setWaMsg({
          type: "ok",
          text: `WA diantrekan ke ${d.queued} nomor, dilewati ${d.skipped?.length ?? 0}.`,
          skipped: d.skipped ?? [],
        });
      }
    } catch {
      setWaMsg({ type: "err", text: "Koneksi bermasalah." });
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <>
      <PageHead
        kicker="Pemberitahuan"
        title="Notifikasi"
        desc="Kirim push notification ke perangkat dan pesan WhatsApp massal ke orang tua."
      />

      {/* Panel 1: Push */}
      <Panel style={{ maxWidth: 640, marginBottom: 20 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 14px" }}>Push Notification</h2>
        <form onSubmit={handlePush} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            Target Penerima:
            <select value={target} onChange={(e) => setTarget(e.target.value as PushTarget)} style={selectStyle}>
              <option value="semua">Semua (Guru & Siswa)</option>
              <option value="guru">Khusus Guru</option>
              <option value="siswa">Khusus Siswa</option>
              <option value="kelas">Per Kelas</option>
            </select>
          </label>

          {target === "kelas" && (
            <label style={labelStyle}>
              Kelas:
              <select value={pushKelas} onChange={(e) => setPushKelas(e.target.value)} style={selectStyle}>
                <option value="">— Pilih kelas —</option>
                {daftarKelas.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </label>
          )}

          <label style={labelStyle}>
            Judul:
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pengumuman Ujian Tengah Semester"
              required
            />
          </label>

          <label style={labelStyle}>
            Isi Pesan:
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Tuliskan detail pengumuman…"
              required
              style={{
                borderRadius: 14,
                border: "1px solid rgba(23,23,22,.25)",
                background: "#fffdf8",
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "inherit",
                width: "100%",
                minHeight: 110,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </label>

          <div style={{ display: "grid" }}>
            <Button variant="sticker" type="submit" disabled={pushBusy} style={{ justifyContent: "center", width: "100%" }}>
              {pushBusy ? "Mengirim…" : "Kirim Push"}
            </Button>
          </div>
        </form>
        {pushMsg && (
          <div style={{ marginTop: 16 }}>
            <Note>{pushMsg.text}</Note>
          </div>
        )}
      </Panel>

      {/* Panel 2: WA */}
      <Panel style={{ maxWidth: 640 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 14px" }}>WhatsApp Massal</h2>
        <form onSubmit={handleWa} style={{ display: "grid", gap: 14 }}>
          <label style={labelStyle}>
            Kelas:
            <select value={waKelas} onChange={(e) => setWaKelas(e.target.value)} style={selectStyle}>
              <option value="">— Pilih kelas —</option>
              {daftarKelas.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            Template Pesan (gunakan {"{nama}"} untuk nama siswa):
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              placeholder="Contoh: Yth. orang tua {nama}, besok ada ujian matematika. Mohon pastikan ananda belajar."
              required
              style={{
                borderRadius: 14,
                border: "1px solid rgba(23,23,22,.25)",
                background: "#fffdf8",
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "inherit",
                width: "100%",
                minHeight: 120,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </label>

          {template && (
            <div style={{
              borderRadius: 14,
              background: "#f0f4ec",
              padding: "10px 14px",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}>
              <strong>Pratinjau:</strong>
              <div style={{ marginTop: 6 }}>{preview}</div>
            </div>
          )}

          <div style={{ display: "grid" }}>
            <Button variant="sticker" type="submit" disabled={waBusy} style={{ justifyContent: "center", width: "100%" }}>
              {waBusy ? "Mengantrekan…" : "Kirim WA"}
            </Button>
          </div>
        </form>
        {waMsg && (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            <Note>{waMsg.text}</Note>
            {waMsg.skipped && waMsg.skipped.length > 0 && (
              <ul style={{ fontSize: 13, color: "#74746d", margin: 0, paddingLeft: 20 }}>
                {waMsg.skipped.slice(0, 20).map((s, i) => (
                  <li key={i}>{s.name} — {s.reason}</li>
                ))}
                {waMsg.skipped.length > 20 && <li>…dan {waMsg.skipped.length - 20} lainnya</li>}
              </ul>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
