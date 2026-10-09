"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "./Icons";

async function getCsrf(): Promise<string> {
  const cached = sessionStorage.getItem("csrf");
  if (cached) return cached;
  const r = await fetch("/api/auth/me");
  const d = await r.json();
  sessionStorage.setItem("csrf", d.csrfToken);
  return d.csrfToken as string;
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": await getCsrf() },
      });
    } finally {
      sessionStorage.removeItem("csrf");
      setBusy(false);
      router.replace("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      title={busy ? "Mengeluarkan akun…" : "Keluar"}
      aria-label="Keluar dari akun"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid rgba(23,23,22,.18)",
        background: "#fffdf8",
        color: "#e85e43",
        cursor: busy ? "wait" : "pointer",
        padding: 0,
        transition: "all .18s ease",
        flexShrink: 0,
      }}
      className="btn-logout-icon"
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          transform: busy ? "scale(0.85)" : "none",
          transition: "transform .2s ease",
        }}
      >
        <IconLogout size={17} color="#e85e43" strokeWidth={2.2} />
      </span>
      <style>{`
        .btn-logout-icon:hover {
          background: #e85e43 !important;
          color: #fffdf8 !important;
          border-color: #c94b35 !important;
          box-shadow: 0 4px 12px rgba(232,94,67,.25);
        }
        .btn-logout-icon:hover svg {
          stroke: #fffdf8 !important;
        }
      `}</style>
    </button>
  );
}
