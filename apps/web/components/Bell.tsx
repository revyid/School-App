"use client";

// Bell: lonceng notifikasi in-app + push notification.
// Dropdown panel ala edukids: unread badge, list notifikasi, tandai dibaca,
// tombol aktifkan/nonaktifkan push browser.
import { useEffect, useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { IconBell } from "./Icons";

type Notif = { id: string; title: string; body: string; readAt: string | null; createdAt: string };

// Subscribe SW push.
async function subscribePush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const r = await fetch("/api/push/vapid-public");
    const { publicKey } = await r.json();

    const reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
    });

    await api("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    return true;
  } catch (e) {
    console.warn("push subscribe gagal", e);
    return false;
  }
}

async function unsubscribePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api("/api/push/subscribe", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return "baru saja";
  if (d < 3600) return `${Math.floor(d / 60)} mnt lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  return `${Math.floor(d / 86400)} hr lalu`;
}

export default function Bell() {
  const { data, reload } = useFetch<{ rows: Notif[]; unread: number }>("/api/notifications");
  const [open, setOpen] = useState(false);
  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushLoading, setPushLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Deteksi status push saat mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("off");
      return;
    }
    navigator.serviceWorker.getRegistration("/").then(async (reg) => {
      if (!reg) return setPushState("off");
      const sub = await reg.pushManager.getSubscription();
      setPushState(sub ? "on" : "off");
    });
  }, []);

  // Tutup dropdown klik luar
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function readAll() {
    await api("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    reload();
  }

  async function togglePush() {
    setPushLoading(true);
    if (pushState === "on") {
      await unsubscribePush().catch(() => {});
      setPushState("off");
    } else {
      const ok = await subscribePush();
      setPushState(ok ? "on" : "off");
    }
    setPushLoading(false);
  }

  const unread = data?.unread ?? 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Tombol lonceng */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) reload(); }}
        aria-label="Notifikasi"
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          border: "1px solid rgba(23,23,22,.18)",
          borderRadius: "50%",
          background: open ? "#eeeadd" : "#fffdf8",
          cursor: "pointer",
          transition: "background .18s",
        }}
      >
        <IconBell size={17} color="#171716" />
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#e85e43",
            border: "1.5px solid #f7f4ec",
          }} />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          right: 0,
          width: 360,
          maxWidth: "95vw",
          background: "#fffdf8",
          border: "1px solid rgba(23,23,22,.14)",
          borderRadius: 20,
          boxShadow: "0 12px 40px rgba(23,23,22,.12)",
          zIndex: 50,
          overflow: "hidden",
        }}>
          {/* Header panel */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px", borderBottom: "1px solid rgba(23,23,22,.1)" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              Notifikasi {unread > 0 && <span style={{ marginLeft: 6, background: "#e85e43", color: "#fffdf8", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "2px 8px" }}>{unread}</span>}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unread > 0 && (
                <button type="button" onClick={readAll} style={{ fontSize: 11, color: "#e85e43", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Tandai semua dibaca
                </button>
              )}
            </div>
          </div>

          {/* List notifikasi */}
          <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 320, overflowY: "auto" }}>
            {!data && <li style={{ padding: "20px 18px", color: "#74746d", fontSize: 13 }}>Memuat…</li>}
            {data?.rows.length === 0 && <li style={{ padding: "20px 18px", color: "#74746d", fontSize: 13, textAlign: "center" }}>Belum ada notifikasi.</li>}
            {data?.rows.map((n) => (
              <li key={n.id} style={{
                padding: "12px 18px",
                borderBottom: "1px solid rgba(23,23,22,.07)",
                display: "grid",
                gridTemplateColumns: "8px 1fr auto",
                gap: "0 10px",
                alignItems: "start",
                background: n.readAt ? "transparent" : "rgba(232,94,67,.04)",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.readAt ? "#d4d0c6" : "#e85e43", marginTop: 5, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: "0 0 2px", fontWeight: n.readAt ? 500 : 700, fontSize: 13, lineHeight: 1.4 }}>{n.title}</p>
                  <p style={{ margin: 0, color: "#74746d", fontSize: 12, lineHeight: 1.5 }}>{n.body}</p>
                </div>
                <span style={{ color: "#a0a096", fontSize: 10, whiteSpace: "nowrap", marginTop: 3 }}>{timeAgo(n.createdAt)}</span>
              </li>
            ))}
          </ul>

          {/* Footer: push toggle */}
          <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(23,23,22,.1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#74746d" }}>
              {pushState === "on" ? "Push notifikasi aktif di perangkat ini" : "Aktifkan notifikasi push?"}
            </span>
            <button
              type="button"
              onClick={togglePush}
              disabled={pushLoading}
              style={{
                padding: "5px 14px",
                borderRadius: 999,
                border: "1px solid rgba(23,23,22,.2)",
                background: pushState === "on" ? "#eeeadd" : "#e85e43",
                color: pushState === "on" ? "#171716" : "#fffdf8",
                fontSize: 11,
                fontWeight: 700,
                cursor: pushLoading ? "wait" : "pointer",
                whiteSpace: "nowrap",
                transition: "background .2s",
              }}
            >
              {pushLoading ? "…" : pushState === "on" ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
