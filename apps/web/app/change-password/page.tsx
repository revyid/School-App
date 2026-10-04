"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <main>
      <h1>Ganti kata sandi</h1>
      <form onSubmit={submit}>
        <label>
          Kata sandi lama
          <input type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          Kata sandi baru (min. 8 karakter)
          <input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          Ulangi kata sandi baru
          <input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Simpan</button>
      </form>
    </main>
  );
}
