"use client";

import { useEffect, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import UploadPopup from "@/components/UploadPopup";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const BRAND_KINDS = [
  { kind: "character", field: "characterImageUrl", label: "Karakter siswi (putri)" },
  { kind: "siswa", field: "siswaImageUrl", label: "Karakter siswa (putra)" },
  { kind: "book", field: "bookImageUrl", label: "Ilustrasi buku (dashboard admin)" },
  { kind: "hero", field: "heroImageUrl", label: "Ilustrasi kelas (CTA portal & guru)" },
] as const;

export default function SettingsPage() {
  const { data } = useFetch<{ settings: Record<string, unknown> }>(`/api/settings`);
  const [f, setF] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [logoVer, setLogoVer] = useState(0);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [brandMsg, setBrandMsg] = useState<string | null>(null);
  const [brandVer, setBrandVer] = useState(0);
  const [brandPreview, setBrandPreview] = useState<Record<string, string>>({});

  async function uploadLogoFile(file: File | null) {
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
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
        aiChatEnabled: String(s.aiChatEnabled ?? false),
        ttsPhrase: String(s.ttsPhrase ?? "{{name}} sudah hadir"),
        ttsPhraseDup: String(s.ttsPhraseDup ?? "{{name}} sudah di catat"),
        mapLat: s.mapLat === null || s.mapLat === undefined ? "" : String(s.mapLat),
        mapLng: s.mapLng === null || s.mapLng === undefined ? "" : String(s.mapLng),
        brandColor: String(s.brandColor ?? ""),
        characterImageUrl: String(s.characterImageUrl ?? ""),
        dashboardBannerUrl: String(s.dashboardBannerUrl ?? ""),
        heroImageUrl: String(s.heroImageUrl ?? ""),
      });
    }
  }, [data]);

  function payload(extra?: Record<string, unknown>) {
    return {
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
      aiChatEnabled: f.aiChatEnabled === "true",
      ttsPhrase: (f.ttsPhrase ?? "").trim() || "{{name}} sudah hadir",
      ttsPhraseDup: (f.ttsPhraseDup ?? "").trim() || "{{name}} sudah di catat",
      mapLat: f.mapLat === "" ? null : Number(f.mapLat),
      mapLng: f.mapLng === "" ? null : Number(f.mapLng),
      brandColor: f.brandColor || null,
      ...extra,
    };
  }

  // settingsSchema punya default untuk field yang tak dikirim, jadi selalu kirim
  // payload lengkap agar PATCH sebagian tidak mereset setelan lain.
  async function patch(extra?: Record<string, unknown>): Promise<string | null> {
    const res = await api("/api/settings", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(extra)),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? null : "Gagal: " + (d.error || res.status);
  }

  async function save() {
    setMsg(await patch() ?? "Tersimpan");
  }

  async function saveColor() {
    const err = await patch();
    setBrandMsg(err ?? "Warna brand tersimpan.");
  }

  async function uploadBrand(kind: string, field: string, file: File | null) {
    if (!file) return;
    setBrandPreview((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
    setBrandMsg("Mengunggah…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api(`/api/settings/branding?kind=${kind}`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBrandMsg("Gagal: " + (d.error || res.status));
        return;
      }
      setF((p) => ({ ...p, [field]: String(d.path ?? "") }));
      setBrandMsg("Gambar tersimpan.");
      setBrandVer((v) => v + 1);
    } catch {
      setBrandMsg("Gagal mengunggah (offline?).");
    }
  }

  async function removeBrand(kind: string, field: string) {
    const err = await patch({ [field]: null });
    if (err) {
      setBrandMsg(err);
      return;
    }
    setF((p) => ({ ...p, [field]: "" }));
    setBrandPreview((p) => ({ ...p, [kind]: "" }));
    setBrandVer((v) => v + 1);
    setBrandMsg("Gambar dihapus.");
  }

  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const brandHex = /^#[0-9a-fA-F]{6}$/.test(f.brandColor ?? "") ? f.brandColor! : "#c2410c";

  return (
    <>
      <PageHead kicker="Sekolah" title="Pengaturan sekolah" desc="Logo, nama portal, jam absensi, kuota WA, retensi data, dan mode password awal." />
      <Card className="max-w-full mb-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Logo sekolah</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rounded-xl object-cover border border-solid border-line bg-paper-deep"
          key={logoVer}
          src="/api/portal/logo"
          alt="Logo sekolah saat ini"
          width={56}
          height={56}
          
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <label className="grid gap-[6px] text-[13px] text-muted mt-[10px]">
          Unggah logo baru (PNG/JPG/WEBP, maks 2MB):
          <UploadPopup label="Pilih logo" maxMb={2} accept="image/png,image/jpeg,image/webp" onFile={uploadLogoFile} />
        </label>
        {logoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="rounded-xl object-cover border border-solid border-line mt-2" src={logoPreview} alt="Pratinjau logo baru" width={56} height={56} />
        )}
        {logoMsg && <Alert>{logoMsg}</Alert>}
      </Card>
      <Card className="max-w-full mb-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Branding sekolah</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {BRAND_KINDS.map((b) => {
            const current = f[b.field];
            const preview = brandPreview[b.kind] || (current ? `/api/portal/branding?kind=${b.kind}&v=${brandVer}` : "");
            return (
              <section key={b.kind} className="grid gap-2 border border-solid border-line rounded-xl p-[14px] bg-cream">
                <h3 className="m-0 text-[14px] text-ink">{b.label}</h3>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rounded-xl object-cover border border-solid border-line bg-paper-deep w-full h-[120px]"
                    src={preview}
                    alt={b.label}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <p className="m-0 text-[12px] text-muted">Belum ada gambar.</p>
                )}
                <UploadPopup label="Pilih gambar" maxMb={2} accept="image/png,image/jpeg,image/webp"
                  onFile={(file) => uploadBrand(b.kind, b.field, file)} />
                {current && (
                  <Button variant="sticker-ghost" size="sm" type="button" onClick={() => removeBrand(b.kind, b.field)}>
                    Hapus
                  </Button>
                )}
              </section>
            );
          })}
        </div>
        <div className="settings-row">
          <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Warna brand (hex)
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pilih warna brand" value={brandHex} onChange={set("brandColor")}
                className="h-10 w-14 rounded-xl border border-solid border-line bg-cream" />
              <Input className="w-full" value={f.brandColor ?? ""} onChange={set("brandColor")} placeholder="#c2410c" />
            </div>
          </label>
          <div className="flex items-center"><Button variant="sticker" type="button" onClick={saveColor}>Simpan warna</Button></div>
        </div>
        {brandMsg && <Alert>{brandMsg}</Alert>}
      </Card>
      <Card className="max-w-[680px]">
        {!data && <Alert>Memuat…</Alert>}
        <div className="grid gap-3">
          <label className="grid gap-[6px] text-[13px] text-muted">Nama portal <Input className="w-full" value={f.portalName ?? ""} onChange={set("portalName")} /></label>
          <div className="settings-row">
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Jam mulai <Input className="w-full" type="time" value={f.startTime ?? ""} onChange={set("startTime")} /></label>
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Batas keterlambatan (cutoff) <Input className="w-full" type="time" value={f.cutoffTime ?? ""} onChange={set("cutoffTime")} /></label>
          </div>
          <div className="settings-row">
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Kuota WA harian <Input className="w-full" type="number" value={f.waDailyCap ?? ""} onChange={set("waDailyCap")} /></label>
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Kuota WA per menit <Input className="w-full" type="number" value={f.waPerMinuteCap ?? ""} onChange={set("waPerMinuteCap")} /></label>
          </div>
          <label className="grid gap-[6px] text-[13px] text-muted">URL Ruang GTK <Input className="w-full" value={f.ctaGtkUrl ?? ""} onChange={set("ctaGtkUrl")} /></label>
          <label className="grid gap-[6px] text-[13px] text-muted">URL Ruang Murid <Input className="w-full" value={f.ctaMuridUrl ?? ""} onChange={set("ctaMuridUrl")} /></label>
          <div className="settings-row">
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Retensi data siswa (hari) <Input className="w-full" type="number" value={f.studentRetentionDays ?? ""} onChange={set("studentRetentionDays")} /></label>
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Retensi foto (hari) <Input className="w-full" type="number" value={f.photoRetentionDays ?? ""} onChange={set("photoRetentionDays")} /></label>
          </div>
          <label className="grid gap-[6px] text-[13px] text-muted">Mode password awal{" "}
            <Select value={f.defaultPasswordMode ?? "random"} onValueChange={(v) => setF((p) => ({ ...p, defaultPasswordMode: v ?? "random" }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="random">Acak</SelectItem>
                <SelectItem value="nisn">NISN (minta ganti saat login pertama)</SelectItem>
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          <section className="grid gap-2 border border-solid border-line rounded-xl p-[14px] bg-cream" aria-labelledby="ai-settings-title">
            <h2 className="text-base m-0 text-ink" id="ai-settings-title">Asisten AI & privasi</h2>
            <label className="grid gap-[6px] text-[13px] text-muted">Chat AI
              <Select value={f.aiChatEnabled ?? "false"} onValueChange={(v) => setF((p) => ({ ...p, aiChatEnabled: v ?? "false" }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  <SelectItem value="false">Nonaktif</SelectItem>
                  <SelectItem value="true">Aktif (jika diizinkan konfigurasi server)</SelectItem>
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
            <Alert>AI hanya tahu panduan website dan info publik sekolah — tidak pernah membaca data pribadi siapa pun (tanpa nama, nilai, absensi, atau tugas individual).</Alert>
          </section>
          <label className="grid gap-[6px] text-[13px] text-muted">Ucapan suara absensi — scan BERHASIL (TTS scanner) — pakai {"{{name}}"} dan {"{{class}}"}
            <Input className="w-full" value={f.ttsPhrase ?? ""} onChange={set("ttsPhrase")} placeholder="{{name}} sudah hadir" />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">Ucapan suara absensi — scan SUDAH DICATAT / duplikat — pakai {"{{name}}"} dan {"{{class}}"}
            <Input className="w-full" value={f.ttsPhraseDup ?? ""} onChange={set("ttsPhraseDup")} placeholder="{{name}} sudah di catat" />
          </label>
          <div className="settings-row">
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Koordinat Peta (Latitude)
              <Input className="w-full" type="number" step="any" value={f.mapLat ?? ""} onChange={set("mapLat")} placeholder="-6.200000" />
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted flex-[1_1_220px]">Koordinat Peta (Longitude)
              <Input className="w-full" type="number" step="any" value={f.mapLng ?? ""} onChange={set("mapLng")} placeholder="106.816666" />
            </label>
          </div>
          <Alert>Koordinat ini menentukan titik lokasi sekolah pada Peta Digital di halaman depan.</Alert>
          <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" onClick={save}>Simpan</Button></div>
          {msg && <p className="font-bold">{msg}</p>}
        </div>
      </Card>
      <style>{`.settings-row { display: flex; gap: 12; flex-wrap: wrap; }
      @media (max-width: 600px) {
        .settings-row { flex-direction: column; }
      }`}</style>
    </>
  );
}
