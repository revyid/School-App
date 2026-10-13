"use client";

// Bell: lonceng notifikasi in-app + push + toast + suara.
// FASE 4: N1 (rata kiri, clamp), N2 (Dialog portal vs Popover inbox),
// N4 (AudioContext singleton), N5 (href tujuan), N9 (Switch push), N10 (state tunggal).
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import Link from "next/link";
import { api, useFetch } from "@/app/lib/api";
import { cn } from "@/lib/utils";
import { BellIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NotifToast, type ToastNotif } from "./SwipeToast";

export type Notif = {
  id: string;
  title: string;
  body: string;
  href?: string | null;
  kind?: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotifData = { rows: Notif[]; unread: number };

// ---- N4: SATU AudioContext untuk semua notifikasi (sebelumnya baru per notifikasi,
// Safari/iOS berhenti setelah ±6 notif). resume() saat gestur pertama. ----
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}
function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx || ctx.state === "suspended") return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch { /* sunyi */ }
}
// Gestur pertama: resume konteks yang suspended (kebijakan autoplay browser).
if (typeof window !== "undefined") {
  const resume = () => { getAudioCtx()?.resume().catch(() => {}); };
  window.addEventListener("pointerdown", resume, { once: true, passive: true });
  window.addEventListener("keydown", resume, { once: true, passive: true });
}

// ---- Push helpers (tidak berubah dari versi lama) ----
async function subscribePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return { ok: false, reason: "Browser ini tidak mendukung Web Push." };
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "denied")
      return { ok: false, reason: "Izin notifikasi diblokir. Buka info situs (ikon gembok) > Izin > Notifikasi > Izinkan." };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "Izin notifikasi belum diberikan. Ketuk Izinkan saat browser meminta." };

    const r = await fetch("/api/push/vapid-public");
    const { publicKey } = await r.json().catch(() => ({}));
    if (!r.ok || !publicKey) return { ok: false, reason: "VAPID server belum tersedia (hubungi admin)." };

    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await reg.update().catch(() => {});
    await navigator.serviceWorker.ready;

    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    let sub: PushSubscription;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
      });
    } catch (e) {
      console.warn("pushManager.subscribe gagal", e);
      return { ok: false, reason: "Browser menolak langganan push (koneksi ke layanan push Google/Firefox gagal atau SW kedaluwarsa). Coba: 1) reload halaman, 2) matikan mode hemat data/VPN, 3) Chrome Android butuh akun Google & Play Services aktif." };
    }

    const res = await api("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      await sub.unsubscribe().catch(() => {});
      const msg =
        res.status === 401 ? "sesi berakhir — login ulang lalu coba lagi."
        : res.status === 403 ? "permintaan ditolak browser/server (CSRF/origin) — reload halaman lalu coba lagi."
        : `${d.error ?? "coba login ulang"}.`;
      return { ok: false, reason: `Server menolak subscription (${res.status}: ${msg})` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("push subscribe gagal", e);
    return { ok: false, reason: "Gagal tak terduga saat mengaktifkan. Reload halaman lalu coba lagi." };
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
  // N10: satu sumber state — turunkan dari useFetch + mutate (tanpa localRows duplikat).
  const { data, loading, refreshing, reload, mutate } = useFetch<NotifData>("/api/notifications");
  const rows = data?.rows ?? [];
  const unread = data?.unread ?? 0;

  const [open, setOpen] = useState(false);
  const [activeNotif, setActiveNotif] = useState<Notif | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastNotif[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const lastUnreadRef = useRef<number | null>(null);
  const initialLoadRef = useRef(true);

  // N4: sakelar suara tersimpan di localStorage.
  useEffect(() => {
    setSoundOn(localStorage.getItem("bell.sound") !== "off");
  }, []);
  const toggleSound = () => {
    setSoundOn((v) => {
      localStorage.setItem("bell.sound", v ? "off" : "on");
      return !v;
    });
  };

  // Chime + antre toast hanya saat unread benar-benar naik (bukan reload).
  useEffect(() => {
    if (!data) return;
    if (!initialLoadRef.current && lastUnreadRef.current !== null && data.unread > lastUnreadRef.current) {
      if (soundOn) playNotificationSound();
      const fresh = data.rows.filter((r) => !r.readAt).slice(0, 3 - Math.min(toastQueue.length, 3));
      if (fresh.length) setToastQueue((q) => [...q, ...fresh].slice(0, 6));
    }
    lastUnreadRef.current = data.unread;
    initialLoadRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Realtime WS: notif baru → reload seketika.
  const reloadRef = useRef(reload);
  useEffect(() => { reloadRef.current = reload; }, [reload]);
  useEffect(() => {
    let sock: Socket | null = null;
    let active = true;
    import("socket.io-client")
      .then(({ io }) => {
        if (!active) return;
        sock = io({ path: "/socket.io/" });
        sock.on("notif:new", () => { reloadRef.current(); });
      })
      .catch(() => { /* abaikan bila socket gagal */ });
    return () => { active = false; sock?.disconnect(); };
  }, []);

  // N10: polling 60 dtk dijeda saat tab tersembunyi; refresh saat kembali aktif.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      reloadRef.current();
    };
    const onVisible = () => { if (!document.hidden) reloadRef.current(); };
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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

  // Buka detail (Dialog portal) + tandai dibaca via mutate.
  const openDetail = useCallback(
    (n: Notif) => {
      setActiveNotif(n);
      if (!n.readAt) {
        const nowIso = new Date().toISOString();
        mutate((prev) =>
          prev
            ? {
                ...prev,
                rows: prev.rows.map((r) => (r.id === n.id ? { ...r, readAt: nowIso } : r)),
                unread: Math.max(0, prev.unread - 1),
              }
            : prev,
        );
        void api("/api/notifications/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ids: [n.id] }),
        }).catch(() => {});
      }
    },
    [mutate],
  );

  const readAll = useCallback(async () => {
    const nowIso = new Date().toISOString();
    mutate((prev) => (prev ? { ...prev, rows: prev.rows.map((r) => ({ ...r, readAt: nowIso })), unread: 0 } : prev));
    await api("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, [mutate]);

  async function togglePush() {
    setPushLoading(true);
    setPushError(null);
    if (pushState === "on") {
      await unsubscribePush().catch(() => {});
      setPushState("off");
    } else {
      const r = await subscribePush();
      setPushState(r.ok ? "on" : "off");
      setPushError(r.ok ? null : r.reason);
    }
    setPushLoading(false);
  }

  return (
    <>
      <div className="relative">
        {/* N9: lonceng = tombol ikon biasa + badge (bukan BellToggle). */}
        <button
          type="button"
          data-bell-toggle
          onClick={() => setOpen((o) => !o)}
          aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ""}`}
          aria-expanded={open}
          className={cn(
            "relative grid size-10 cursor-pointer place-items-center rounded-full border border-line bg-cream text-ink outline-none transition-colors hover:bg-paper focus-visible:ring-[3px] focus-visible:ring-ring/30",
            open && "bg-ink text-cream",
          )}
        >
          <BellIcon className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-terracotta px-1 text-[10px] font-extrabold text-cream" aria-hidden="true">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>

        {/* N2: inbox = panel non-modal (bukan <Popover modal>) agar popup detail
            yang dibuka darinya tidak menutup inbox. */}
        {open && (
          <BellInbox
            rows={rows}
            loading={loading}
            refreshing={refreshing}
            unread={unread}
            soundOn={soundOn}
            pushState={pushState}
            pushLoading={pushLoading}
            pushError={pushError}
            onClose={() => setOpen(false)}
            onOpenItem={openDetail}
            onReadAll={readAll}
            onToggleSound={toggleSound}
            onTogglePush={togglePush}
          />
        )}
      </div>

      {/* N2: popup detail = Dialog portal. Menutup dialog TIDAK menutup inbox;
          klik di dalam dialog tidak dianggap klik-luar (portal). Fokus kembali
          otomatis ke tombol pemicu. */}
      <Dialog open={!!activeNotif} onOpenChange={(o) => { if (!o) setActiveNotif(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left">{activeNotif?.title}</DialogTitle>
            <DialogDescription className="text-left">
              {activeNotif
                ? new Date(activeNotif.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  }) + " WIB"
                : ""}
            </DialogDescription>
          </DialogHeader>
          {/* Teks penuh membungkus (bukan terpotong). */}
          <div className="max-h-[40vh] overflow-y-auto rounded-2xl border border-line bg-paper p-4 text-sm leading-relaxed text-ink" style={{ overflowWrap: "anywhere" }}>
            {activeNotif?.body}
          </div>
          <div className="flex justify-end gap-2">
            {activeNotif?.href && (
              <Button render={<Link href={activeNotif.href} />}>Buka</Button>
            )}
            <Button variant="outline" onClick={() => setActiveNotif(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* N3: toast antre (judul maks 2 baris, isi 3 baris). */}
      <NotifToast
        queue={toastQueue}
        onClose={(id) => setToastQueue((q) => q.filter((t) => t.id !== id))}
        onOpen={(n) => {
          const full = (data?.rows ?? []).find((r) => r.id === n.id);
          if (full) openDetail(full);
          setToastQueue([]);
        }}
      />
    </>
  );
}

// ---- Inbox panel (N1: daftar rata kiri, judul 2 baris, isi 2 baris) ----
function BellInbox({
  rows, loading, refreshing, unread, soundOn, pushState, pushLoading, pushError,
  onClose, onOpenItem, onReadAll, onToggleSound, onTogglePush,
}: {
  rows: Notif[];
  loading: boolean;
  refreshing: boolean;
  unread: number;
  soundOn: boolean;
  pushState: "unknown" | "on" | "off";
  pushLoading: boolean;
  pushError: string | null;
  onClose: () => void;
  onOpenItem: (n: Notif) => void;
  onReadAll: () => void;
  onToggleSound: () => void;
  onTogglePush: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [escOn, setEscOn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setEscOn(true), 150); // hindari Esc yang membuka panel
    if (!escOn) return () => clearTimeout(t);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [escOn, onClose]);

  // Klik/touch luar menutup inbox (pointerdown mencakup sentuhan HP).
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      // Klik di dalam portal (Dialog detail) bukan klik-luar.
      if (t.closest?.('[data-slot="dialog-content"]')) return;
      // Klik pada tombol lonceng ditangani toggle-nya sendiri (hindari
      // balapan pointerdown-tutup vs click-buka = kedip tutup-buka).
      if (t.closest?.("[data-bell-toggle]")) return;
      if (ref.current && !ref.current.contains(t)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifikasi"
      className="bell-panel absolute top-[calc(100%+10px)] right-0 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-line bg-cream shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="text-sm font-extrabold">
          Notifikasi
          {unread > 0 && (
            <span className="ml-2 rounded-full bg-terracotta px-2 py-0.5 text-[10px] font-extrabold text-cream">
              {unread} belum dibaca
            </span>
          )}
          {refreshing && <span className="sr-only">Memuat ulang…</span>}
        </span>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button type="button" onClick={onReadAll} className="cursor-pointer border-0 bg-none p-0 text-[11px] font-bold text-terracotta hover:underline">
              Tandai semua dibaca
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSound}
            className="grid size-7 cursor-pointer place-items-center rounded-full text-muted-strong transition-colors hover:bg-paper-deep"
            aria-label={soundOn ? "Matikan suara notifikasi" : "Nyalakan suara notifikasi"}
            aria-pressed={soundOn}
          >
            {soundOn ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
          </button>
        </div>
      </div>

      {/* Daftar notifikasi — N1: butir rata kiri (width penuh, text-align left). */}
      <ul className="m-0 max-h-[340px] list-none overflow-y-auto p-0">
        {loading && !rows.length && (
          <li className="px-4 py-6">
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-paper-deep" />
              ))}
            </div>
          </li>
        )}
        {rows.length === 0 && !loading && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Belum ada notifikasi.</li>
        )}
        {rows.map((n) => {
          const isUnread = !n.readAt;
          return (
            <li key={n.id} className="list-none">
              <button
                type="button"
                onClick={() => onOpenItem(n)}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto] items-start gap-x-2.5 border-b border-line/50 px-4 py-3 text-left outline-none transition-colors focus-visible:bg-paper",
                  isUnread ? "bg-terracotta/5 hover:bg-terracotta/10" : "bg-transparent hover:bg-paper",
                )}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", isUnread ? "bg-terracotta" : "bg-transparent")} />
                <span className="min-w-0 overflow-hidden">
                  <span className={cn("mb-0.5 line-clamp-2 block text-[13px] leading-snug", isUnread ? "font-bold" : "font-medium", "text-ink")} style={{ overflowWrap: "anywhere" }}>
                    {n.title}
                  </span>
                  <span className="line-clamp-2 block text-xs leading-snug text-muted-foreground" style={{ overflowWrap: "anywhere" }}>
                    {n.body}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 whitespace-nowrap text-[10px] text-muted-strong">{timeAgo(n.createdAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* N9: push = Switch berlabel, bukan BellToggle. */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/60 px-4 py-3">
        <span className="text-xs text-muted-foreground">Notifikasi push di perangkat ini</span>
        <Switch checked={pushState === "on"} onCheckedChange={() => onTogglePush()} disabled={pushLoading || pushState === "unknown"} aria-label="Aktifkan notifikasi push" />
      </div>
      {pushError && <p className="m-0 px-4 pb-3 text-[11px] text-terracotta-dark" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{pushError}</p>}
    </div>
  );
}
