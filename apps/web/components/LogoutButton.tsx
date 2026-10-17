"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLogout } from "./Icons";
import { cn } from "@/lib/utils";

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
      className={cn(
        "group inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-cream p-0 text-terracotta transition-all duration-[180ms]",
        busy
          ? "cursor-wait"
          : "cursor-pointer hover:border-terracotta-dark hover:bg-terracotta-deep hover:text-cream hover:shadow-[0_4px_12px_rgba(232,94,67,0.25)]",
      )}
    >
      <span className={cn("grid place-items-center transition-transform duration-200", busy && "scale-[0.85]")}>
        <IconLogout size={17} strokeWidth={2.2} className="text-terracotta group-hover:text-cream" />
      </span>
    </button>
  );
}
