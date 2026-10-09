"use client";

import { useCallback, useEffect, useState } from "react";

function shouldRedirectSession(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return !(p === "/" || p === "/buku" || p === "/login" || p === "/anonim" || p === "/tools" || p.startsWith("/portal") || p.startsWith("/public") || p.startsWith("/tools/"));
}

export async function api(path: string, init?: RequestInit & { csrf?: boolean }) {
  const headers = new Headers(init?.headers);
  if (init?.csrf !== false && init?.method && init.method !== "GET") {
    let token = sessionStorage.getItem("csrf");
    if (!token) {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (d.csrfToken) {
        sessionStorage.setItem("csrf", d.csrfToken);
        token = d.csrfToken;
      }
    }
    if (token) headers.set("x-csrf-token", token);
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && shouldRedirectSession()) {
    sessionStorage.removeItem("csrf");
    window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
  }
  return res;
}

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401 && shouldRedirectSession()) {
        sessionStorage.removeItem("csrf");
        window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, loading, error, reload };
}
