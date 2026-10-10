"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Note, Err } from "@/components/DashUI";

export default function SettingsPage() {
  const { data } = useFetch<{ settings: Record<string, unknown> }>(`/api/settings`);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoVer, setLogoVer] = useState(0);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoMsg("Mengunggah…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api("/api/settings/logo", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLogoMsg("Gagal: " + (d.error || res.status));
        return;
      }
      setLogoMsg("Logo tersimpan — tampil di sidebar, landing, dan login.");
      setLogoVer((v) => v + 1);
    } catch {
      setLogoMsg("Gagal mengunggah (offline?).");
    }
  }

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
        ttsPhrase: String(s.ttsPhrase ?? "{{name}} sudah hadir"),
        ttsPhraseDup: String(s.ttsPhraseDup ?? "{{name}} sudah di catat"),
        mapLat: s.mapLat === null || s.mapLat === undefined ? "" : String(s.mapLat),
        mapLng: s.mapLng === null || s.mapLng === undefined ? "" : String(s.mapLng),
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
        ttsPhrase: (f.ttsPhrase ?? "").trim() || "{{name}} sudah hadir",
        ttsPhraseDup: (f.ttsPhraseDup ?? "").trim() || "{{name}} sudah di catat",
        mapLat: f.mapLat === "" ? null : Number(f.mapLat),
        mapLng: f.mapLng === "" ? null : Number(f.mapLng),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Tersimpan" : "Gagal: " + (d.error || res.status));
  }

  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <PageHead kicker="Sekolah" title="Pengaturan sekolah" desc="Logo, nama portal, jam absensi, kuota WA, retensi data, dan mode password awal." />
      <Panel style={{ maxWidth: "100%", marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Logo sekolah</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={logoVer}
          src="/api/portal/logo"
          alt="Logo sekolah saat ini"
          width={56}
          height={56}
          style={{ borderRadius: 12, objectFit: "cover", border: "1px solid rgba(23,23,22,.14)", background: "#eeeadd" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", marginTop: 10 }}>
          Unggah logo baru (PNG/JPG/WEBP, maks 2MB):
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} />
        </label>
        {logoMsg && <Note>{logoMsg}</Note>}
      </Panel>
      <Panel style={{ maxWidth: 680 }}>
        {!data && <Note>Memuat…</Note>}
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Nama portal <TextInput value={f.portalName ?? ""} onChange={set("portalName")} style={{ width: "100%" }} /></label>
          <div className="settings-row">
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Jam mulai <TextInput type="time" value={f.startTime ?? ""} onChange={set("startTime")} style={{ width: "100%" }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Batas keterlambatan (cutoff) <TextInput type="time" value={f.cutoffTime ?? ""} onChange={set("cutoffTime")} style={{ width: "100%" }} /></label>
          </div>
          <div className="settings-row">
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Kuota WA harian <TextInput type="number" value={f.waDailyCap ?? ""} onChange={set("waDailyCap")} style={{ width: "100%" }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Kuota WA per menit <TextInput type="number" value={f.waPerMinuteCap ?? ""} onChange={set("waPerMinuteCap")} style={{ width: "100%" }} /></label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>URL Ruang GTK <TextInput value={f.ctaGtkUrl ?? ""} onChange={set("ctaGtkUrl")} style={{ width: "100%" }} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>URL Ruang Murid <TextInput value={f.ctaMuridUrl ?? ""} onChange={set("ctaMuridUrl")} style={{ width: "100%" }} /></label>
          <div className="settings-row">
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Retensi data siswa (hari) <TextInput type="number" value={f.studentRetentionDays ?? ""} onChange={set("studentRetentionDays")} style={{ width: "100%" }} /></label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Retensi foto (hari) <TextInput type="number" value={f.photoRetentionDays ?? ""} onChange={set("photoRetentionDays")} style={{ width: "100%" }} /></label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Mode password awal{" "}
            <TextSelect value={f.defaultPasswordMode ?? "random"} onChange={set("defaultPasswordMode")} style={{ width: "100%" }}>
              <option value="random">Acak</option>
              <option value="nisn">NISN (minta ganti saat login pertama)</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Ucapan suara absensi — scan BERHASIL (TTS scanner) — pakai {"{{name}}"} dan {"{{class}}"}
            <TextInput value={f.ttsPhrase ?? ""} onChange={set("ttsPhrase")} placeholder="{{name}} sudah hadir" style={{ width: "100%" }} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>Ucapan suara absensi — scan SUDAH DICATAT / duplikat — pakai {"{{name}}"} dan {"{{class}}"}
            <TextInput value={f.ttsPhraseDup ?? ""} onChange={set("ttsPhraseDup")} placeholder="{{name}} sudah di catat" style={{ width: "100%" }} />
          </label>
          <div className="settings-row">
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Koordinat Peta (Latitude)
              <TextInput type="number" step="any" value={f.mapLat ?? ""} onChange={set("mapLat")} placeholder="-6.200000" style={{ width: "100%" }} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d", flex: "1 1 220px" }}>Koordinat Peta (Longitude)
              <TextInput type="number" step="any" value={f.mapLng ?? ""} onChange={set("mapLng")} placeholder="106.816666" style={{ width: "100%" }} />
            </label>
          </div>
          <Note>Koordinat ini menentukan titik lokasi sekolah pada Peta Digital di halaman depan.</Note>
          <Toolbar><Btn onClick={save}>Simpan</Btn></Toolbar>
          {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        </div>
      </Panel>
      <style>{`.settings-row { display: flex; gap: 12; flex-wrap: wrap; }
      @media (max-width: 600px) {
        .settings-row { flex-direction: column; }
      }`}</style>
    </>
  );
}
