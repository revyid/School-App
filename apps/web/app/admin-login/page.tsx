"use client";

// Login SUPER_ADMIN — hanya dilayani di admin.<apex> (lihat proxy + admin-login route).
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(d.error ?? "Email atau kata sandi salah");
      return;
    }
    if (d.csrfToken) sessionStorage.setItem("csrf", d.csrfToken);
    router.replace("/pantau");
  }

  return (
    <main>
      <h1>Masuk Super-Admin</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
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
