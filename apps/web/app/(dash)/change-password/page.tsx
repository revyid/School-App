"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOld] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (p1 !== p2) {
      setError("konfirmasi password tidak sama");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await api("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword: p1 }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "gagal mengganti password");
        return;
      }
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead kicker="Akun" title="Ganti kata sandi" desc="Minimal 8 karakter. Setelah berhasil kamu diminta login ulang." />
      <Card className="max-w-[480px]">
        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1.5 text-[13px] text-muted">
            Kata sandi lama
            <Input type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" required />
          </label>
          <label className="grid gap-1.5 text-[13px] text-muted">
            Kata sandi baru (min. 8 karakter)
            <Input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" required />
          </label>
          <label className="grid gap-1.5 text-[13px] text-muted">
            Ulangi kata sandi baru
            <Input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button></div>
        </form>
      </Card>
    </>
  );
}
