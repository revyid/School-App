"use client";

// Login SUPER_ADMIN — hanya dilayani di admin.<apex> (lihat proxy + admin-login route).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput, Btn, Err } from "@/components/DashUI";

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
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(12px, 4vw, 24px)" }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: "clamp(18px, 5vw, 28px)" }}>
        <p className="kicker" style={{ margin: "0 0 8px" }}>Super-admin</p>
        <h1 className="display" style={{ fontSize: 28, margin: "0 0 6px" }}>Masuk pengelola</h1>
        <p style={{ color: "#74746d", fontSize: 13.5, margin: "0 0 18px" }}>Hanya untuk pengelola platform, bukan warga sekolah.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Email
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Kata sandi
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <Err>{error}</Err>}
          <Btn type="submit" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Btn>
        </form>
      </div>
    </main>
  );
}
