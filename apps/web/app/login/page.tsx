"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ROLE_HOME } from "@sms/shared/auth";
import PublicLogo from "@/components/PublicLogo";

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

  const input: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(23,23,22,.2)",
    background: "#fffdf8",
    padding: "12px 16px",
    fontSize: 14,
    marginTop: 6,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: "8%", left: "6%", zIndex: 0 }} className="anim-drift" aria-hidden="true">
        <svg width="90" height="46" viewBox="0 0 90 46" fill="none">
          <ellipse cx="45" cy="23" rx="40" ry="18" stroke="#e85e43" strokeWidth="2" strokeDasharray="7 6" transform="rotate(-12 45 23)" />
        </svg>
      </div>
      <div style={{ position: "absolute", bottom: "10%", right: "8%", zIndex: 0 }} className="anim-drift" aria-hidden="true">
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <path d="M23 4v38M4 23h38M9 9l28 28M37 9L9 37" stroke="#f5c94a" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      <div
        className="card"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 920,
          display: "flex",
          overflow: "hidden",
          borderRadius: 34,
        }}
      >
        <div style={{ flex: 1, padding: "clamp(24px, 4vw, 48px)", minWidth: 0 }}>
          <PublicLogo />
          <p className="kicker" style={{ marginTop: 22 }}>Masuk ke dasbor sekolah</p>
          <h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 44px)", margin: "8px 0 6px" }}>
            Belajar boleh serius. <span style={{ color: "#e85e43" }}>Serunya jangan hilang.</span>
          </h1>
          <p style={{ color: "#74746d", fontSize: 13.5, margin: "0 0 20px" }}>
            Masuk dengan email atau NISN yang diberikan sekolah.
          </p>
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Email atau NISN
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required style={input} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Kata sandi
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={input} />
            </label>
            {error && <p role="alert" style={{ color: "#c94b35", fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={busy} className="btn-sticker btn-primary" style={{ justifyContent: "center", marginTop: 4 }}>
              {busy ? "Memproses…" : "Masuk ↗"}
            </button>
          </form>
        </div>
        <div
          className="login-side"
          style={{
            flex: 0.9,
            background: "#50643e",
            color: "#fffdf8",
            padding: "clamp(24px, 4vw, 48px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Image
            src="/assets/char-student.png"
            alt=""
            width={240}
            height={280}
            className="anim-floaty"
            style={{ objectFit: "contain" }}
            priority
          />
          <p style={{ fontWeight: 800, fontSize: 17, textAlign: "center", margin: 0, letterSpacing: "-0.02em" }}>
            “Satu langkah kecil hari ini, satu dunia baru besok.”
          </p>
        </div>
      </div>

      <style>{`@media (max-width: 760px) { .login-side { display: none; } }`}</style>
    </main>
  );
}
