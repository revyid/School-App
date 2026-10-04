"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <button type="button" onClick={logout} disabled={busy}>
      {busy ? "Keluar…" : "Keluar"}
    </button>
  );
}
