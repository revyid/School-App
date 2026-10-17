"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function shouldRedirectSession(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return !(
    p === "/" ||
    p === "/syarat" ||
    p === "/privasi" ||
    p === "/buku" ||
    p === "/login" ||
    p === "/anonim" ||
    p === "/perkakas" ||
    p.startsWith("/portal") ||
    p.startsWith("/public") ||
    p.startsWith("/perkakas/")
  );
}

async function redirectLogin() {
  sessionStorage.removeItem("csrf");
  window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
}

async function fetchCsrfToken(): Promise<string | null> {
  const r = await fetch("/api/auth/me", { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (d.csrfToken) {
    sessionStorage.setItem("csrf", d.csrfToken);
    return d.csrfToken as string;
  }
  return null;
}

// F3: bila 403 karena token CSRF basi (mis. sesi dipulihkan), ambil token baru lalu ulangi SEKALI.
async function apiOnce(path: string, init: RequestInit, retried: boolean): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 403 && !retried && init.method && init.method !== "GET") {
    const probe = await fetch("/api/auth/me", { cache: "no-store" });
    if (probe.status === 401) {
      if (shouldRedirectSession()) await redirectLogin();
      return res;
    }
    const d = await probe.json().catch(() => ({}));
    if (d.csrfToken) {
      sessionStorage.setItem("csrf", d.csrfToken);
      const headers = new Headers(init.headers);
      headers.set("x-csrf-token", d.csrfToken);
      return apiOnce(path, { ...init, headers }, true);
    }
  }
  if (res.status === 401 && shouldRedirectSession()) await redirectLogin();
  return res;
}

export async function api(path: string, init?: RequestInit & { csrf?: boolean }) {
  const headers = new Headers(init?.headers);
  if (init?.csrf !== false && init?.method && init.method !== "GET") {
    let token = sessionStorage.getItem("csrf");
    if (!token) token = await fetchCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }
  return apiOnce(path, { ...init, headers }, false);
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  /** true saat reload() dijalankan dengan data lama masih tampil (tidak mengosongkan layar). */
  refreshing: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Optimistic update: ubah data lokal segera (mis. tandai dibaca), sinkron saat reload berikut. */
  mutate: (updater: (prev: T | null) => T | null) => void;
}

// F3: useFetch — AbortController per permintaan (bukan per path),
// data lama dipertahankan saat reload, 401 hanya ditangani sekali.
export function useFetch<T>(path: string | null): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const redirectedRef = useRef(false);
  const hasDataRef = useRef(false);
  const pathRef = useRef(path);
  pathRef.current = path;

  const reload = useCallback(async () => {
    if (!pathRef.current) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const hadData = hasDataRef.current;
    if (hadData) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(pathRef.current, { cache: "no-store", signal: ctrl.signal });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401 && shouldRedirectSession()) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          await redirectLogin();
        }
        return;
      }
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      hasDataRef.current = true;
      setData(d as T);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const mutate = useCallback((updater: (prev: T | null) => T | null) => {
    setData((prev) => updater(prev));
  }, []);

  useEffect(() => {
    hasDataRef.current = false;
    setData(null);
    setLoading(!!path);
    setError(null);
    void reload();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return { data, loading, refreshing, error, reload, mutate };
}
