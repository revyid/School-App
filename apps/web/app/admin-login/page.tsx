"use client";

// Login SUPER_ADMIN — hanya dilayani di admin.<apex> (lihat proxy + admin-login route).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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
    try {
      const r = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Email atau kata sandi salah");
        return;
      }
      if (d.csrfToken) sessionStorage.setItem("csrf", d.csrfToken);
      router.replace(d.mustChangePassword ? "/change-password" : "/pantau");
    } catch {
      setError("Koneksi gagal. Periksa internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-[clamp(12px,4vw,24px)]">
      <div className="card w-full max-w-[400px] p-[clamp(18px,5vw,28px)]">
        <p className="kicker m-0 mb-2">Super-admin</p>
        <h1 className="display m-0 mb-1.5 text-[28px]">Masuk pengelola</h1>
        <p className="m-0 mb-[18px] text-[13.5px] text-muted">Hanya untuk pengelola platform, bukan warga sekolah.</p>
        <form onSubmit={submit} className="grid gap-3">
          <label className="grid gap-1.5 text-[13px] text-muted">
            Email
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </label>
          <label className="grid gap-1.5 text-[13px] text-muted">
            Kata sandi
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button variant="sticker" type="submit" disabled={busy}>{busy ? "Memproses…" : "Masuk"}</Button>
        </form>
      </div>
    </main>
  );
}
