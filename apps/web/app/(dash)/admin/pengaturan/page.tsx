"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function SettingsPage() {
  const { data } = useFetch<{ settings: Record<string, unknown> }>(`/api/settings`);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings as Record<string, unknown>;
      setF({
        portalName: String(s.portalName ?? ""),
        startTime: String(s.startTime ?? "07:00"),
        cutoffTime: String(s.cutoffTime ?? "07:30"),
        waDailyCap: String(s.waDailyCap ?? 200),
        waPerMinuteCap: String(s.waPerMinuteCap ?? 10),
        ctaGtkUrl: String(s.ctaGtkUrl ?? ""),
        ctaMuridUrl: String(s.ctaMuridUrl ?? ""),
        studentRetentionDays: String(s.studentRetentionDays ?? 90),
        photoRetentionDays: String(s.photoRetentionDays ?? 30),
        defaultPasswordMode: String(s.defaultPasswordMode ?? "random"),
      });
    }
  }, [data]);

  async function save() {
    const res = await api("/api/settings", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        portalName: f.portalName,
        startTime: f.startTime,
        cutoffTime: f.cutoffTime,
        waDailyCap: Number(f.waDailyCap),
        waPerMinuteCap: Number(f.waPerMinuteCap),
        ctaGtkUrl: f.ctaGtkUrl || null,
        ctaMuridUrl: f.ctaMuridUrl || null,
        studentRetentionDays: Number(f.studentRetentionDays),
        photoRetentionDays: Number(f.photoRetentionDays),
        defaultPasswordMode: f.defaultPasswordMode === "nisn" ? "nisn" : "random",
      }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Tersimpan" : "Gagal: " + (d.error || res.status));
  }

  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <main>
      <h1>Pengaturan Sekolah</h1>
      <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <label>Nama portal <input value={f.portalName ?? ""} onChange={set("portalName")} /></label>
        <label>Jam mulai <input type="time" value={f.startTime ?? ""} onChange={set("startTime")} /></label>
        <label>Batas keterlambatan (cutoff) <input type="time" value={f.cutoffTime ?? ""} onChange={set("cutoffTime")} /></label>
        <label>Kuota WA harian <input type="number" value={f.waDailyCap ?? ""} onChange={set("waDailyCap")} /></label>
        <label>Kuota WA per menit <input type="number" value={f.waPerMinuteCap ?? ""} onChange={set("waPerMinuteCap")} /></label>
        <label>URL Ruang GTK <input value={f.ctaGtkUrl ?? ""} onChange={set("ctaGtkUrl")} /></label>
        <label>URL Ruang Murid <input value={f.ctaMuridUrl ?? ""} onChange={set("ctaMuridUrl")} /></label>
        <label>Retensi data siswa (hari) <input type="number" value={f.studentRetentionDays ?? ""} onChange={set("studentRetentionDays")} /></label>
        <label>Retensi foto (hari) <input type="number" value={f.photoRetentionDays ?? ""} onChange={set("photoRetentionDays")} /></label>
        <label>Mode password awal{" "}
          <select value={f.defaultPasswordMode ?? "random"} onChange={set("defaultPasswordMode")}>
            <option value="random">Acak</option>
            <option value="nisn">NISN (minta ganti saat login pertama)</option>
          </select>
        </label>
        <button onClick={save}>Simpan</button>
        {msg && <p>{msg}</p>}
      </div>
    </main>
  );
}
