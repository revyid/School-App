"use client";

// Root: setelan satu sekolah — portal, warna brand, dan branding (unggah via
// endpoint root). PATCH selalu mengirim snapshot setelan yang ada supaya
// default schema tidak mereset field lain.
import { use, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { api, useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SchoolSettings {
  portalName?: string | null;
  characterImageUrl?: string | null;
  heroImageUrl?: string | null;
  dashboardBannerUrl?: string | null;
  brandColor?: string | null;
  [key: string]: unknown;
}

interface SchoolDetail {
  id: string;
  slug: string;
  name: string;
  lat: number | null;
  lng: number | null;
  logoUrl: string | null;
  settings: SchoolSettings | null;
}

type Msg = { variant: "success" | "destructive"; text: string } | null;

const BRAND_KINDS = [
  { kind: "character", field: "characterImageUrl", label: "Gambar karakter" },
  { kind: "book", field: "bookImageUrl", label: "Ilustrasi buku" },
  { kind: "hero", field: "heroImageUrl", label: "Gambar hero" },
] as const;

export default function RootSchoolSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useFetch<{ school: SchoolDetail }>(`/api/root/schools/${id}`);
  const school = data?.school;
  const [portalName, setPortalName] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!school) return;
    setPortalName(school.settings?.portalName || school.name || "");
    setBrandColor(school.settings?.brandColor ?? "");
  }, [school]);

  function payload(extra?: Record<string, unknown>) {
    return {
      ...(school?.settings ?? {}),
      portalName,
      brandColor: brandColor || null,
      ...extra,
    };
  }

  async function patch(extra?: Record<string, unknown>) {
    const res = await api(`/api/root/schools/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload(extra)),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? null : d.error || `Gagal menyimpan (${res.status})`;
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const err = await patch();
    setMsg(err ? { variant: "destructive", text: err } : { variant: "success", text: "Setelan disimpan." });
    if (!err) await reload();
    setBusy(false);
  }

  async function removeBrand(field: string) {
    setBusy(true);
    setMsg(null);
    const err = await patch({ [field]: null });
    setMsg(err ? { variant: "destructive", text: err } : { variant: "success", text: "Gambar dihapus." });
    if (!err) await reload();
    setBusy(false);
  }

  async function uploadBrand(kind: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await api(`/api/root/schools/${id}/branding?kind=${kind}`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? { variant: "success", text: "Gambar tersimpan." }
        : { variant: "destructive", text: d.error || `Gagal mengunggah (${res.status})` },
    );
    if (res.ok) await reload();
    setBusy(false);
  }

  const s = school?.settings ?? {};
  const rows: [string, string][] = [
    ["Nama portal", String(s.portalName ?? school?.name ?? "—")],
    ["Warna brand", String(s.brandColor ?? "—")],
    ["Tema portal", String(s.portalTheme ?? "—")],
    ["Jam mulai / cutoff", `${String(s.startTime ?? "—")} / ${String(s.cutoffTime ?? "—")}`],
    ["Kuota WA", `${String(s.waDailyCap ?? "—")} / hari · ${String(s.waPerMinuteCap ?? "—")} / menit`],
    ["Retensi siswa / foto", `${String(s.studentRetentionDays ?? "—")} / ${String(s.photoRetentionDays ?? "—")} hari`],
    ["Mode password awal", String(s.defaultPasswordMode ?? "—")],
    ["Chat AI", s.aiChatEnabled ? "Aktif" : "Nonaktif"],
    ["Koordinat", `${String(school?.lat ?? "—")}, ${String(school?.lng ?? "—")}`],
  ];

  return (
    <>
      <PageHead
        kicker="Sekolah"
        title={school?.name ?? "Setelan sekolah"}
        desc={school ? `Setelan portal dan branding untuk ${school.slug}.` : "Memuat setelan sekolah…"}
        right={
          <Button variant="sticker-ghost" render={<Link href="/pantau/schools" />}>
            Kembali
          </Button>
        }
      />

      {error && <Alert variant="destructive">{error}</Alert>}
      {loading && !data && <Alert>Memuat setelan sekolah…</Alert>}
      {msg && <Alert variant={msg.variant}>{msg.text}</Alert>}

      {school && (
        <>
          <Card className="mb-4">
            <h2 className="display m-0 text-[18px]">Identitas</h2>
            <label className="grid gap-1 text-[13px] text-muted">
              Nama portal
              <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder={school.name} />
            </label>
            <label className="grid gap-1 text-[13px] text-muted">
              Warna brand (hex)
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pilih warna brand"
                  value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#c2410c"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 rounded-xl border border-solid border-line bg-cream"
                />
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#c2410c" />
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="sticker" type="button" disabled={busy} onClick={save}>Simpan</Button>
            </div>
          </Card>

          <Card className="mb-4">
            <h2 className="display m-0 text-[18px]">Branding</h2>
            <p className="m-0 text-[13px] text-muted">
              Unggah PNG/JPG/WEBP maks 2MB. File disajikan per host sekolah lewat /api/portal/branding.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {BRAND_KINDS.map((b) => (
                <section key={b.kind} className="grid gap-2 rounded-xl border border-solid border-line bg-cream p-[14px]">
                  <h3 className="m-0 text-[14px] text-ink">{b.label}</h3>
                  <p className="m-0 break-all font-meta text-[11px] text-muted">{String(s[b.field] ?? "Belum ada gambar")}</p>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={`Unggah ${b.label}`}
                    disabled={busy}
                    onChange={(e) => uploadBrand(b.kind, e)}
                    className="text-[13px]"
                  />
                  {s[b.field] ? (
                    <Button variant="sticker-ghost" size="sm" type="button" disabled={busy} onClick={() => removeBrand(b.field)}>
                      Hapus
                    </Button>
                  ) : null}
                </section>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="display m-0 text-[18px]">Ringkasan setelan</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setelan</TableHead>
                  <TableHead>Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(([k, v]) => (
                  <TableRow key={k}>
                    <TableCell className="text-muted">{k}</TableCell>
                    <TableCell className="font-bold text-ink">{v}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
