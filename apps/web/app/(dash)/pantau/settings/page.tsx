"use client";

// Root: hero platform + identitas. Endpoint PATCH/upload di-wire terpisah oleh API author.
import { useEffect, useState, type ChangeEvent } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RootSettings {
  platformName?: string;
  platformTagline?: string;
  heroImageUrl?: string | null;
}

interface SettingsResponse extends RootSettings {
  settings?: RootSettings;
}

type Msg = { variant: "success" | "destructive"; text: string } | null;

export default function PantauSettingsPage() {
  const { data, loading, error, reload } = useFetch<SettingsResponse>("/api/root/settings");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [version, setVersion] = useState(0);
  const [heroOk, setHeroOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const s = data?.settings ?? data;
    if (!s) return;
    setName(s.platformName ?? "");
    setTagline(s.platformTagline ?? "");
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

  async function saveIdentity() {
    setBusy(true);
    setMsg(null);
    const res = await api("/api/root/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformName: name, platformTagline: tagline }),
    });
    const d = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? { variant: "success", text: "Identitas disimpan." }
        : { variant: "destructive", text: d.error || `Gagal menyimpan (${res.status})` },
    );
    setBusy(false);
  }

  const heroSrc = data?.heroImageUrl
    ? `${data.heroImageUrl}${data.heroImageUrl.includes("?") ? "&" : "?"}v=${version}`
    : null;

  return (
    <>
      <PageHead
        kicker="Pengaturan"
        title="Platform"
        desc="Hero dan identitas yang tampil di seluruh sekolah."
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
          <span className="font-meta text-[10px] text-muted">PNG/JPG/WebP</span>
        </div>
      </Card>

      <Card>
        <h2 className="display m-0 text-[18px]">Identitas platform</h2>
        <label className="grid gap-1 text-[13px] text-muted">
          Nama platform
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lacakedu" />
        </label>
        <label className="grid gap-1 text-[13px] text-muted">
          Tagline
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Satu platform untuk semua sekolah" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="sticker" type="button" disabled={busy} onClick={saveIdentity}>
            Simpan
          </Button>
          <span className="font-meta text-[10px] text-muted">
            Pratinjau saja — perubahan mengikuti endpoint /api/root/settings.
          </span>
        </div>
      </Card>
    </>
  );
}
