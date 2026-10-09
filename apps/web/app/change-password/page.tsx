"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Err } from "@/components/DashUI";

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
      <Panel style={{ maxWidth: 480 }}>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Kata sandi lama
            <TextInput type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Kata sandi baru (min. 8 karakter)
            <TextInput type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Ulangi kata sandi baru
            <TextInput type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" required />
          </label>
          {error && <Err>{error}</Err>}
          <Toolbar><Btn type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Btn></Toolbar>
        </form>
      </Panel>
    </>
  );
}
