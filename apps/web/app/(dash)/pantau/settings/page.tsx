"use client";

// Root: hero platform + identitas + fitur. Endpoint PATCH/upload di-wire terpisah oleh API author.
import { useEffect, useState, type ChangeEvent } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface FeatureFlags {
  aiChat?: boolean;
  waBroadcast?: boolean;
  ebook?: boolean;
  qrAttendance?: boolean;
  studentImport?: boolean;
}

interface RootSettings {
  platformName?: string;
  platformTagline?: string;
  heroImageUrl?: string | null;
  platformLogoUrl?: string | null;
  primaryColor?: string | null;
  supportEmail?: string | null;
  featureFlags?: FeatureFlags;
}

interface SettingsResponse extends RootSettings {
  settings?: RootSettings;
}

type Msg = { variant: "success" | "destructive"; text: string } | null;

const FEATURES: { key: keyof FeatureFlags; label: string }[] = [
  { key: "aiChat", label: "Chat AI" },
  { key: "waBroadcast", label: "Siaran WhatsApp" },
  { key: "ebook", label: "E-book" },
  { key: "qrAttendance", label: "Absensi QR" },
  { key: "studentImport", label: "Impor murid" },
];

export default function PantauSettingsPage() {
  const { data, loading, error, reload } = useFetch<SettingsResponse>("/api/root/settings");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [color, setColor] = useState("");
  const [email, setEmail] = useState("");
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [version, setVersion] = useState(0);
  const [heroOk, setHeroOk] = useState(true);
  const [logoOk, setLogoOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const s = data?.settings ?? data;
    if (!s) return;
    setName(s.platformName ?? "");
    setTagline(s.platformTagline ?? "");
    setColor(data?.primaryColor ?? "");
    setEmail(data?.supportEmail ?? "");
    setFlags(data?.featureFlags ?? {});
  }, [data]);

  async function uploadHero(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await api("/api/root/settings/hero", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ variant: "destructive", text: d.error || `Gagal mengunggah (${res.status})` });
    } else {
      setMsg({ variant: "success", text: "Hero diperbarui." });
      setHeroOk(true);
      setVersion(Date.now());
      await reload();
    }
    setBusy(false);
  }

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await api("/api/root/settings/logo", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ variant: "destructive", text: d.error || `Gagal mengunggah (${res.status})` });
    } else {
      setMsg({ variant: "success", text: "Logo platform diperbarui." });
      setLogoOk(true);
      setVersion(Date.now());
      await reload();
    }
    setBusy(false);
  }

  async function saveSettings() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/root/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        platformName: name,
        platformTagline: tagline,
        primaryColor: color.trim() || null,
        supportEmail: email.trim() || null,
        featureFlags: flags,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? { variant: "success", text: "Setelan disimpan." }
        : { variant: "destructive", text: d.error || `Gagal menyimpan (${res.status})` },
    );
    setBusy(false);
  }

  const heroSrc = data?.heroImageUrl
    ? `${data.heroImageUrl}${data.heroImageUrl.includes("?") ? "&" : "?"}v=${version}`
    : null;
  const logoSrc = data?.platformLogoUrl ? `/api/portal/platform-logo?v=${version}` : null;

  return (
    <>
      <PageHead
        kicker="Pengaturan"
        title="Platform"
        desc="Hero, identitas, dan fitur yang tampil di seluruh sekolah."
        right={
          <a
            href="/beranda"
            target="_blank"
            rel="noreferrer"
            className="font-meta text-[10px] text-muted underline"
          >
            Pratinjau landing →
          </a>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {loading && !data && <Alert>Memuat pengaturan…</Alert>}
      {msg && <Alert variant={msg.variant}>{msg.text}</Alert>}

      <Card className="mb-4">
        <h2 className="display m-0 text-[18px]">Hero</h2>
        {heroOk && heroSrc ? (
          <img
            key={version}
            src={heroSrc}
            alt="Pratinjau hero platform"
            onError={() => setHeroOk(false)}
            style={{
              width: "100%",
              maxHeight: 280,
              objectFit: "cover",
              borderRadius: 16,
              border: "1px solid var(--color-line)",
              background: "var(--color-paper-deep)",
            }}
          />
        ) : (
          <Alert>Belum ada gambar hero.</Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*"
            aria-label="Unggah gambar hero"
            disabled={busy}
            onChange={uploadHero}
            className="text-[13px]"
          />
          <span className="font-meta text-[10px] text-muted">PNG/JPG/WebP maks 2MB</span>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="display m-0 text-[18px]">Logo platform</h2>
        {logoOk && logoSrc ? (
          <img
            key={version}
            src={logoSrc}
            alt="Pratinjau logo platform"
            onError={() => setLogoOk(false)}
            style={{
              height: 72,
              maxWidth: 240,
              objectFit: "contain",
              borderRadius: 12,
              border: "1px solid var(--color-line)",
              background: "var(--color-paper-deep)",
            }}
          />
        ) : (
          <Alert>Belum ada logo platform.</Alert>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/*"
            aria-label="Unggah logo platform"
            disabled={busy}
            onChange={uploadLogo}
            className="text-[13px]"
          />
          <span className="font-meta text-[10px] text-muted">PNG/JPG/WebP maks 2MB</span>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="display m-0 text-[18px]">Identitas platform</h2>
        <label className="grid gap-1 text-[13px] text-muted">
          Nama platform
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lacakedu" />
        </label>
        <label className="grid gap-1 text-[13px] text-muted">
          Tagline
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Satu platform untuk semua sekolah" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-[13px] text-muted">
            Warna utama (hex)
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#1D6B4F" maxLength={7} />
          </label>
          <label className="grid gap-1 text-[13px] text-muted">
            Email dukungan
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bantuan@lacakedu.id" />
          </label>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="display m-0 text-[18px]">Fitur</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <span className="text-[13px]">{f.label}</span>
              <Switch
                checked={flags[f.key] === true}
                onCheckedChange={(v) => setFlags((p) => ({ ...p, [f.key]: v === true }))}
                aria-label={`Aktifkan ${f.label}`}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="sticker" type="button" disabled={busy} onClick={saveSettings}>
            Simpan
          </Button>
          <span className="font-meta text-[10px] text-muted">
            Identitas dan fitur disimpan lewat /api/root/settings.
          </span>
        </div>
      </Card>
    </>
  );
}
