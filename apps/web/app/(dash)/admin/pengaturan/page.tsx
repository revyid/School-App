"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Note, Err } from "@/components/DashUI";

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
    <>
      <PageHead kicker="Sekolah" title="Pengaturan sekolah" desc="Nama portal, jam absensi, kuota WA, retensi data, dan mode password awal." />
      <Panel style={{ maxWidth: 620 }}>
        {!data && <Note>Memuat…</Note>}
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Nama portal <TextInput value={f.portalName ?? ""} onChange={set("portalName")} /></label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Jam mulai <TextInput type="time" value={f.startTime ?? ""} onChange={set("startTime")} style={{ width: "auto" }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Batas keterlambatan (cutoff) <TextInput type="time" value={f.cutoffTime ?? ""} onChange={set("cutoffTime")} style={{ width: "auto" }} /></label>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Kuota WA harian <TextInput type="number" value={f.waDailyCap ?? ""} onChange={set("waDailyCap")} style={{ width: 140 }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Kuota WA per menit <TextInput type="number" value={f.waPerMinuteCap ?? ""} onChange={set("waPerMinuteCap")} style={{ width: 140 }} /></label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>URL Ruang GTK <TextInput value={f.ctaGtkUrl ?? ""} onChange={set("ctaGtkUrl")} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>URL Ruang Murid <TextInput value={f.ctaMuridUrl ?? ""} onChange={set("ctaMuridUrl")} /></label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Retensi data siswa (hari) <TextInput type="number" value={f.studentRetentionDays ?? ""} onChange={set("studentRetentionDays")} style={{ width: 140 }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Retensi foto (hari) <TextInput type="number" value={f.photoRetentionDays ?? ""} onChange={set("photoRetentionDays")} style={{ width: 140 }} /></label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Mode password awal{" "}
            <TextSelect value={f.defaultPasswordMode ?? "random"} onChange={set("defaultPasswordMode")}>
              <option value="random">Acak</option>
              <option value="nisn">NISN (minta ganti saat login pertama)</option>
            </TextSelect>
          </label>
          <Toolbar><Btn onClick={save}>Simpan</Btn></Toolbar>
          {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        </div>
      </Panel>
    </>
  );
}
