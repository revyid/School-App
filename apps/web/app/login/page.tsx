"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_HOME } from "@sms/shared/auth";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      if (d.user?.mustChangePassword) router.replace("/change-password");
      else if (d.user?.role) router.replace(ROLE_HOME[d.user.role as keyof typeof ROLE_HOME] ?? "/siswa");
    }).catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? "Email/NISN atau kata sandi salah");
      return;
    }
    if (d.csrfToken) sessionStorage.setItem("csrf", d.csrfToken);
    if (d.mustChangePassword) router.replace("/change-password");
    else router.replace(ROLE_HOME[d.user.role as keyof typeof ROLE_HOME] ?? "/siswa");
  }

  return (
    <main>
      <h1>Masuk</h1>
      <form onSubmit={submit}>
        <label>
          Email atau NISN
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Kata sandi
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</button>
      </form>
    </main>
  );
}
