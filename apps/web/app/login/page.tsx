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
  const [schoolName, setSchoolName] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [setuju, setSetuju] = useState(false);

  function safeNext(): string | null {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("expired") === "1") setNotice("Sesi berakhir, silakan login ulang.");
      const next = q.get("next") ?? "";
      // Hanya path internal — tolak //evil, http:, javascript:.
      if (/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(next) && !next.startsWith("//")) return next || null;
    } catch { /* abaikan */ }
    return null;
  }

  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      const back = safeNext();
      if (back) {
        router.replace(back);
        return;
      }
      if (d.user?.mustChangePassword) router.replace("/change-password");
      else if (d.user?.role) router.replace(ROLE_HOME[d.user.role as keyof typeof ROLE_HOME] ?? "/siswa");
    }).catch(() => {});
    fetch("/api/portal/info").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json().catch(() => null);
      if (d?.school?.name) setSchoolName(d.school.name);
    }).catch(() => {});
    safeNext();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!setuju) {
      setError("Centang persetujuan Syarat & Kebijakan Privasi sebelum masuk.");
      return;
    }
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
    await fetch("/api/auth/consent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": sessionStorage.getItem("csrf") ?? "" },
    }).catch(() => {});
    const back = safeNext();
    if (d.mustChangePassword) router.replace("/change-password");
    else if (back) router.replace(back);
    else router.replace(ROLE_HOME[d.user.role as keyof typeof ROLE_HOME] ?? "/siswa");
  }

  const input: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(23,23,22,.2)",
    background: "#fffdf8",
    padding: "12px 16px",
    fontSize: 15,
    minHeight: 48,
    marginTop: 6,
    boxSizing: "border-box",
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
      <div className="login-deco anim-drift" style={{ position: "absolute", top: "8%", left: "6%", zIndex: 0 }} aria-hidden="true">
        <svg width="90" height="46" viewBox="0 0 90 46" fill="none">
          <ellipse cx="45" cy="23" rx="40" ry="18" stroke="#e85e43" strokeWidth="2" strokeDasharray="7 6" transform="rotate(-12 45 23)" />
        </svg>
      </div>
      <div className="login-deco anim-drift" style={{ position: "absolute", bottom: "10%", right: "8%", zIndex: 0 }} aria-hidden="true">
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <path d="M23 4v38M4 23h38M9 9l28 28M37 9L9 37" stroke="#f5c94a" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      <div
        className="card login-card"
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
        <div className="login-form" style={{ flex: 1, padding: "clamp(20px, 3vw, 48px)", minWidth: 0 }}>
          <PublicLogo name={schoolName} />
          <p className="kicker" style={{ marginTop: 22 }}>Masuk ke dasbor sekolah</p>
          <h1 className="display login-heading" style={{ fontSize: "clamp(24px, 3.5vw, 44px)", margin: "8px 0 6px" }}>
            Belajar boleh serius. <span style={{ color: "#e85e43" }}>Serunya jangan hilang.</span>
          </h1>
          <p style={{ color: "#74746d", fontSize: 13.5, margin: "0 0 20px" }}>
            Masuk dengan email atau NISN yang diberikan sekolah.
          </p>
          <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
            {notice && <p role="status" style={{ color: "#8a6d1b", background: "#f5c94a33", border: "1px solid #f5c94a", borderRadius: 12, padding: "8px 12px", fontSize: 13, margin: 0 }}>{notice}</p>}
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Email atau NISN
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required style={input} />
            </label>
            <label style={{ fontSize: 13, fontWeight: 700 }}>
              Kata sandi
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={input} />
            </label>
            {error && <p role="alert" style={{ color: "#c94b35", fontSize: 13, margin: 0 }}>{error}</p>}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, fontWeight: 400, lineHeight: 1.6, color: "#575752", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={setuju}
                onChange={(e) => setSetuju(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "#171716", flexShrink: 0 }}
              />
              <span>
                Saya menyetujui{" "}
                <a href="/syarat" target="_blank" rel="noreferrer" style={{ color: "#171716", fontWeight: 700 }}>Syarat Layanan</a>{" "}
                dan{" "}
                <a href="/privasi" target="_blank" rel="noreferrer" style={{ color: "#171716", fontWeight: 700 }}>Kebijakan Privasi</a>{" "}
                (UU PDP No. 27/2022). Persetujuan ini dicatat sekolah.
              </span>
            </label>
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

      <style>{`
        @media (max-width: 760px) {
          .login-card { position: relative !important; max-width: 440px !important; border-radius: 24px !important; overflow: hidden !important; }
          .login-side {
            display: flex !important;
            position: absolute !important;
            inset: 0 !important;
            opacity: 0.18 !important;
            pointer-events: none !important;
            z-index: 0 !important;
            padding: 0 !important;
            justify-content: flex-end !important;
            align-items: flex-end !important;
            background: transparent !important;
          }
          .login-side img {
            width: 200px !important;
            height: 220px !important;
            opacity: 0.85 !important;
            transform: translate(24px, 24px) !important;
          }
          .login-side p { display: none !important; }
          .login-form { position: relative !important; z-index: 1 !important; padding: 24px 20px 28px !important; }
          .login-heading { font-size: 24px !important; line-height: 1.2 !important; }
          .login-deco { display: none !important; }
        }
        @media (max-width: 480px) {
          main { padding: 12px !important; }
          .card { border-radius: 22px !important; }
          .login-form { padding: 22px 16px 24px !important; }
          .login-heading { font-size: 21px !important; }
          .portal-header-cta { font-size: 11px !important; padding: 7px 12px !important; }
          input { font-size: 16px !important; }
          .login-side img {
            width: 170px !important;
            height: 190px !important;
            transform: translate(16px, 16px) !important;
          }
        }
      `}</style>
    </main>
  );
}
