"use client";

// Bell: lonceng notifikasi in-app + push notification + toast banner + suara audio chime.
import { useEffect, useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import BellToggle from "./BellToggle";
import SwipeToast from "./SwipeToast";
import { IconBell } from "./Icons";

type Notif = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

// Suara notifikasi (synthesized via Web Audio API — 100% offline, ringan, merdu)
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Nada 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nada 2: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch {}
}

// Subscribe SW push
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
  const [localRows, setLocalRows] = useState<Notif[]>([]);
  const [localUnread, setLocalUnread] = useState(0);

  const [open, setOpen] = useState(false);
  const [activeNotif, setActiveNotif] = useState<Notif | null>(null);
  const [toastNotif, setToastNotif] = useState<Notif | null>(null);

  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushLoading, setPushLoading] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const lastUnreadRef = useRef<number | null>(null);
  const initialLoadRef = useRef(true);

  // Sinkronkan data saat fetch selesai
  useEffect(() => {
    if (data) {
      setLocalRows(data.rows);
      setLocalUnread(data.unread);

      // Jika unread bertambah setelah initial load, bunyikan chime + tampilkan toast
      if (!initialLoadRef.current && lastUnreadRef.current !== null && data.unread > lastUnreadRef.current) {
        playNotificationSound();
        const newest = data.rows[0];
        if (newest && !newest.readAt) {
          setToastNotif(newest);
        }
      }
      lastUnreadRef.current = data.unread;
      initialLoadRef.current = false;
    }
  }, [data]);

  // Polling notifikasi setiap 20 detik secara otomatis
  useEffect(() => {
    const timer = setInterval(() => {
      reload();
    }, 20_000);
    return () => clearInterval(timer);
  }, [reload]);

  // Auto-dismiss toast setelah 6 detik
  useEffect(() => {
    if (!toastNotif) return;
    const t = setTimeout(() => setToastNotif(null), 6000);
    return () => clearTimeout(t);
  }, [toastNotif]);

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

  // Buka detail popup notifikasi dan tandai telah dibaca
  async function openDetail(n: Notif) {
    setActiveNotif(n);
    if (!n.readAt) {
      // Tandai di lokal seketika agar titik merah langsung hilang
      const nowIso = new Date().toISOString();
      setLocalRows((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, readAt: nowIso } : item))
      );
      setLocalUnread((prev) => Math.max(0, prev - 1));

      // Kirim ke server
      await api("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {});
    }
  }

  // Tandai SEMUA dibaca: hilangkan semua titik merah & set counter ke 0
  async function readAll() {
    const nowIso = new Date().toISOString();
    setLocalRows((prev) => prev.map((item) => ({ ...item, readAt: nowIso })));
    setLocalUnread(0);

    await api("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
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

  const unread = localUnread;

  return (
    <>
      <div ref={ref} style={{ position: "relative" }}>
        {/* Tombol lonceng React Bits BellToggle */}
        <BellToggle
          count={unread}
          badge
          badgeColor="#e85e43"
          color="#171716"
          background="#fffdf8"
          onColor="#fffdf8"
          onBackground="#171716"
          size="sm"
          offLabel="Notifikasi"
          onLabel="Notifikasi Aktif"
          onChange={() => {
            setOpen((o) => !o);
            if (!open) reload();
          }}
        />

        {/* Dropdown panel */}
        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 380,
              maxWidth: "95vw",
              background: "#fffdf8",
              border: "1px solid rgba(23,23,22,.14)",
              borderRadius: 20,
              boxShadow: "0 12px 40px rgba(23,23,22,.12)",
              zIndex: 50,
              overflow: "hidden",
            }}
          >
            {/* Header panel */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px 10px",
                borderBottom: "1px solid rgba(23,23,22,.1)",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 14 }}>
                Notifikasi{" "}
                {unread > 0 && (
                  <span
                    style={{
                      marginLeft: 6,
                      background: "#e85e43",
                      color: "#fffdf8",
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 8px",
                    }}
                  >
                    {unread} belum dibaca
                  </span>
                )}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={readAll}
                    style={{
                      fontSize: 11,
                      color: "#e85e43",
                      fontWeight: 700,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Tandai semua dibaca ✓
                  </button>
                )}
              </div>
            </div>

            {/* List notifikasi */}
            <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 340, overflowY: "auto" }}>
              {!data && (
                <li style={{ padding: "20px 18px", color: "#74746d", fontSize: 13 }}>
                  Memuat notifikasi…
                </li>
              )}
              {data && localRows.length === 0 && (
                <li style={{ padding: "24px 18px", color: "#74746d", fontSize: 13, textAlign: "center" }}>
                  Belum ada notifikasi.
                </li>
              )}
              {localRows.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    onClick={() => openDetail(n)}
                    style={{
                      padding: "12px 18px",
                      borderBottom: "1px solid rgba(23,23,22,.07)",
                      display: "grid",
                      gridTemplateColumns: "10px 1fr auto",
                      gap: "0 10px",
                      alignItems: "start",
                      background: isUnread ? "rgba(232,94,67,.05)" : "transparent",
                      cursor: "pointer",
                      transition: "background .15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread ? "rgba(232,94,67,.09)" : "#f7f4ec";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread ? "rgba(232,94,67,.05)" : "transparent";
                    }}
                  >
                    {/* Titik indikator unread (hanya muncul bila belum dibaca) */}
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: isUnread ? "#e85e43" : "transparent",
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <p
                        style={{
                          margin: "0 0 2px",
                          fontWeight: isUnread ? 700 : 500,
                          fontSize: 13,
                          lineHeight: 1.4,
                          color: "#171716",
                        }}
                      >
                        {n.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: "#74746d",
                          fontSize: 12,
                          lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {n.body}
                      </p>
                    </div>
                    <span style={{ color: "#a0a096", fontSize: 10, whiteSpace: "nowrap", marginTop: 3 }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Footer: push toggle via React Bits BellToggle */}
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid rgba(23,23,22,.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "#faf8f2",
              }}
            >
              <span style={{ fontSize: 12, color: "#74746d" }}>
                Push notifikasi HP/Browser
              </span>
              <BellToggle
                offLabel="Aktifkan"
                onLabel="Tersambung"
                size="sm"
                color="#fffdf8"
                background="#e85e43"
                onColor="#171716"
                onBackground="#aec6a4"
                pressed={pushState === "on"}
                disabled={pushLoading}
                count={unread}
                badge={unread > 0}
                onChange={() => togglePush()}
              />
            </div>
          </div>
        )}
      </div>

      {/* POPUP MODAL DETAIL NOTIFIKASI */}
      {activeNotif && (
        <div
          role="dialog"
          aria-label="Detail Notifikasi"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23,23,22,.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 100,
          }}
          onClick={() => setActiveNotif(null)}
        >
          <div
            style={{
              background: "#fffdf8",
              borderRadius: 24,
              padding: "24px 28px",
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 60px rgba(23,23,22,.2)",
              border: "2px solid #171716",
              display: "grid",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <span
                  style={{
                    background: "#f5c94a",
                    border: "1px solid #171716",
                    borderRadius: 99,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Pemberitahuan
                </span>
                <h3 className="display" style={{ margin: "8px 0 2px", fontSize: 20, lineHeight: 1.25 }}>
                  {activeNotif.title}
                </h3>
                <span style={{ fontSize: 11, color: "#74746d" }}>
                  {new Date(activeNotif.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  WIB
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNotif(null)}
                style={{
                  background: "#eeeadd",
                  border: "1px solid #171716",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#f7f4ec",
                padding: "16px 18px",
                borderRadius: 16,
                fontSize: 14,
                lineHeight: 1.65,
                color: "#171716",
                whiteSpace: "pre-wrap",
                border: "1px solid rgba(23,23,22,.1)",
              }}
            >
              {activeNotif.body}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setActiveNotif(null)}
                style={{
                  background: "#171716",
                  color: "#fffdf8",
                  padding: "9px 20px",
                  borderRadius: 99,
                  fontWeight: 700,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST POPUP SAAT NOTIFIKASI BARU MASUK (React Bits SwipeToast) */}
      <SwipeToast
        open={!!toastNotif}
        onClose={() => setToastNotif(null)}
        title={toastNotif?.title ?? ''}
        description={toastNotif?.body ?? ''}
        icon={<IconBell size={18} color="#f5c94a" />}
        actionLabel="Buka"
        onAction={() => {
          if (toastNotif) {
            openDetail(toastNotif);
            setToastNotif(null);
          }
        }}
        background="#171716"
        color="#fffdf8"
        fuseColor="#e85e43"
        width={360}
        radius={18}
        duration={6000}
        fuse="bottom"
        pauseOnHover
        closeButton={false}
      />
    </>
  );
}
