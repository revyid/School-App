"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHead, Panel, Toolbar, TextInput, Btn, Err } from "@/components/DashUI";

async function csrf(): Promise<string> {
  const cached = sessionStorage.getItem("csrf");
  if (cached) return cached;
  const r = await fetch("/api/auth/me");
  if (!r.ok) throw new Error("sesi tidak valid, silakan login ulang");
  const d = await r.json();
  if (!d.csrfToken) throw new Error("sesi tidak valid, silakan login ulang");
  sessionStorage.setItem("csrf", d.csrfToken);
  return d.csrfToken as string;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOld] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (p1 !== p2) {
      setError("konfirmasi password tidak sama");
      return;
    }
    let token: string;
    try {
      token = await csrf();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const r = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token },
      body: JSON.stringify({ oldPassword, newPassword: p1 }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error ?? "gagal mengganti password");
      return;
    }
    router.replace("/login");
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
          <Toolbar><Btn type="submit">Simpan</Btn></Toolbar>
        </form>
      </Panel>
    </>
  );
}
