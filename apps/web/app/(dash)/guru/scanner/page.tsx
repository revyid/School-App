"use client";

// Scanner QR absensi (guru): kamera via getUserMedia + BarcodeDetector bila ada,
// fallback input manual. Antrean offline: scan tersimpan di localStorage dan
// di-retry otomatis saat koneksi kembali. Bunyi nama via server TTS Piper ID
// (/api/tts, antre agar tidak tumpang tindih) saat event realtime Socket.io tiba.
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, useFetch } from "@/app/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import SwipeToast from "@/components/SwipeToast";
import { useCamera } from "@/components/useCamera";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface ScanItem { token: string; at: number; tries: number }
const QUEUE_KEY = "att-offline-queue";

function loadQueue(): ScanItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveQueue(q: ScanItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(0, 200)));
  } catch { /* abaikan */ }
}

// Antrean suara server: mainkan audio dari /api/tts?text=... satu per satu.
// Perangkat iOS/Android tetap aman karena .play() dibuka saat pemanasan (warmVoice).
const speakQueue: string[] = [];
let speaking = false;
// Kontrol output suara (diatur dari slider di dashboard, tersimpan di localStorage).
let voiceVol = 1;
let voiceRate = 1;

function warmVoice() {
  try {
    const a = new Audio("/api/tts?text=" + encodeURIComponent("Suara aktif"));
    a.volume = 0.01;
    a.play().catch(() => {});
  } catch { /* abaikan */ }
}

function speak(text: string) {
  if (!text.trim()) return;
  speakQueue.push(text);
  if (speaking) return;
  speaking = true;

  const next = () => {
    const t = speakQueue.shift();
    if (!t) {
      speaking = false;
      return;
    }
    try {
      const url = "/api/tts?text=" + encodeURIComponent(t);
      const a = new Audio(url);
      a.volume = Math.min(1, Math.max(0, voiceVol));
      a.playbackRate = Math.min(2, Math.max(0.5, voiceRate));
      a.onended = next;
      a.onerror = next;
      a.play().catch(() => next());
    } catch {
      next();
    }
  };
  next();
}

export default function ScannerPage() {
  const { data: settingsData } = useFetch<{ settings: { ttsPhrase?: string; ttsPhraseDup?: string } }>("/api/settings");
  const ttsTemplate = settingsData?.settings?.ttsPhrase || "{{name}} sudah hadir";
  const ttsTemplateDup = settingsData?.settings?.ttsPhraseDup || "{{name}} sudah di catat";

  const cam = useCamera("environment");
  const videoRef = cam.videoRef;
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [lastScan, setLastScan] = useState<{ name: string; className: string | null; duplicate: boolean } | null>(null);
  const [toastScan, setToastScan] = useState<{ title: string; desc: string; duplicate: boolean } | null>(null);
  // Kontrol volume (0–100%) & kecepatan suara TTS (0.5–2x). Tersimpan per perangkat.
  const [vol, setVol] = useState(100);
  const [rate, setRate] = useState(1);
  // FASE 3: status decoder QR (Brave tanpa BarcodeDetector → fallback jsQR).
  const [scanState, setScanState] = useState<"idle" | "mencari" | "tanpa-decoder" | "qr-asing">("idle");
  const [scanDetail, setScanDetail] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("tts-vol") ?? 100);
      const r = Number(localStorage.getItem("tts-rate") ?? 1);
      if (Number.isFinite(v)) { setVol(Math.min(100, Math.max(0, v))); voiceVol = Math.min(1, Math.max(0, v / 100)); }
      if (Number.isFinite(r)) { setRate(Math.min(2, Math.max(0.5, r))); voiceRate = Math.min(2, Math.max(0.5, r)); }
    } catch { /* abaikan */ }
  }, []);
  const scanning = useRef(false);
  // Cegah suara ganda: event socket untuk scan yang sama tiba <3 dtk setelah suara lokal.
  const lastSpokeAt = useRef(0);

  const formatText = useCallback((tmpl: string, name: string, className?: string | null) => {
    return tmpl
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*class\s*\}\}/gi, className || "");
  }, []);

  const postToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const res = await api("/api/attendance/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || `Gagal (${res.status})`);
        return false;
      }
      const nama: string = d.student?.name ?? "-";
      const cls: string | null = d.student?.className ?? null;
      const isDup = !!d.duplicate;
      const reason: string = typeof d.reason === "string" ? d.reason : "";
      setLastScan({ name: nama, className: cls, duplicate: isDup });
      setMsg(isDup ? `Sudah tercatat (${reason === "cooldown" ? "baru saja" : "hari ini"})` : null);

      if (nama !== "-") {
        lastSpokeAt.current = Date.now();
        const tmpl = isDup ? ttsTemplateDup : ttsTemplate;
        speak(formatText(tmpl, nama, cls));

        setToastScan({
          title: isDup ? "Sudah Dicatat" : "Absensi Berhasil",
          desc: `${nama}${cls ? ` (${cls})` : ""} — ${isDup ? "kehadiran sudah terekam" : "hadir"}`,
          duplicate: isDup,
        });
      }
      return true;
    } catch {
      // offline -> antrekan
      const q = loadQueue();
      q.push({ token, at: Date.now(), tries: 0 });
      saveQueue(q);
      setOfflineCount(q.length);
      setMsg("Offline — scan diantrekan, otomatis dikirim saat online");
      return false;
    }
  }, [formatText, ttsTemplate, ttsTemplateDup]);

  // Retry antrean offline tiap 10 detik + saat online kembali.
  useEffect(() => {
    setOfflineCount(loadQueue().length);
    const flush = async () => {
      const q = loadQueue();
      if (q.length === 0 || !navigator.onLine) return;
      const rest: ScanItem[] = [];
      for (const item of q) {
        try {
          const res = await api("/api/attendance/scan", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: item.token }),
          });
          if (!res.ok && res.status !== 404) rest.push({ ...item, tries: item.tries + 1 });
        } catch {
          rest.push({ ...item, tries: item.tries + 1 });
        }
      }
      saveQueue(rest);
      setOfflineCount(rest.length);
      if (rest.length < q.length) setMsg(`Antrean offline terkirim (${q.length - rest.length})`);
    };
    const t = setInterval(flush, 10_000);
    window.addEventListener("online", flush);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", flush);
    };
  }, []);

  // Socket.io realtime (dibroadcast worker): untuk scanner lain.
  // Scan lokal sudah bersuara dari respons — lewati bila <3 dtk.
  useEffect(() => {
    let sock: Socket | null = null;
    try {
      sock = io({ path: "/socket.io/" });
      sock.on("att:scan", (ev: { name: string; className?: string | null }) => {
        if (!ev?.name) return;
        if (Date.now() - lastSpokeAt.current < 3000) return;
        speak(formatText(ttsTemplate, ev.name, ev.className ?? null));
      });
    } catch { /* abaikan bila socket gagal */ }
    return () => {
      sock?.disconnect();
    };
  }, [formatText, ttsTemplate]);

  const startCamera = useCallback(async () => {
    if (cam.streaming || cam.starting) return;
    warmVoice();
    const ok = await cam.start();
    if (!ok && cam.error) setMsg(cam.error.message + " — gunakan input manual di bawah");
  }, [cam]);

  const stopCamera = useCallback(() => {
    cam.stop();
  }, [cam]);

  // Loop deteksi: BarcodeDetector tiap 500ms; token sms1-* langsung dipost.
  // FASE 3: Brave Android tidak punya BarcodeDetector → fallback jsQR
  // (lazy-import, hanya di scanner) dari frame video via canvas.
  const decodeWithJsqr = useCallback(async (video: HTMLVideoElement): Promise<string | null> => {
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }
    const w = Math.min(640, video.videoWidth);
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const { default: jsQR } = await import("jsqr");
    const code = jsQR(img.data, img.width, img.height);
    return code?.data?.trim() ?? null;
  }, []);

  useEffect(() => {
    if (!cam.streaming) { setScanState("idle"); return; }
    let alive = true;
    setScanState("mencari");
    let jsqrFailed = false;
    const loop = async () => {
      let bdFailed = false;
      while (alive) {
        await new Promise((r) => setTimeout(r, 500));
        if (!alive || scanning.current) continue;
        try {
          const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
          let val: string | null | undefined;
          if (BD && videoRef.current) {
            const det = new BD({ formats: ["qr_code"] });
            const codes = await det.detect(videoRef.current).catch(() => []);
            val = codes[0]?.rawValue?.trim();
          } else {
            bdFailed = true;
            val = videoRef.current ? await decodeWithJsqr(videoRef.current).catch(() => { jsqrFailed = true; return null; }) : null;
          }
          if (!val) {
            if (bdFailed && jsqrFailed) setScanState("tanpa-decoder");
            else if (alive) setScanState("mencari");
            continue;
          }
          if (/^sms1-[0-9a-f]{32}$/.test(val)) {
            scanning.current = true;
            setScanState("mencari");
            setScanDetail(null);
            await postToken(val);
            setTimeout(() => {
              scanning.current = false;
            }, 2000);
          } else {
            // QR terdeteksi tapi bukan token absensi: beri tahu, jangan diam.
            setScanState("qr-asing");
            setScanDetail(val.length > 48 ? `${val.slice(0, 48)}…` : val);
          }
        } catch { /* abaikan frame gagal */ }
      }
    };
    loop();
    return () => {
      alive = false;
    };
  }, [cam.streaming, postToken]);

  return (
    <>
      <PageHead
        kicker="Absensi"
        title="Scanner kehadiran"
        desc="Arahkan kamera ke kartu QR siswa. Bisa offline, antrean terkirim otomatis."
        right={<a className={cn(buttonVariants({ variant: "sticker-ghost" }), "no-underline")} href="/guru/kehadiran">Lihat rekap hari ini</a>}
      />
      <Card className="max-w-[640px]">
        {offlineCount > 0 && (
          <p className="mt-0 mr-0 mb-3 ml-0"><Badge variant={statusVariant("PENDING")}>Antrean offline: {offlineCount} (otomatis dikirim saat online)</Badge></p>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {!cam.streaming
            ? <Button className="bg-ink text-cream" variant="sticker"  type="button" onClick={() => { void startCamera(); }}>Nyalakan kamera</Button>
            : <Button variant="sticker-ghost" type="button" onClick={stopCamera}>Matikan kamera</Button>}
          <Button variant="sticker-ghost" type="button" onClick={warmVoice}>Aktifkan suara</Button>
        </div>

        {/* KONTROL VOLUME & KECEPATAN SUARA TTS */}
        <div className="grid grid-cols-[repeat(auto-fit,_minmax(180px,_1fr))] gap-[14px] bg-ink/5 border border-solid border-line rounded-[14px] pt-3 pr-4 pb-3 pl-4 mt-3 mr-0 mb-4 ml-0">
          <label className="grid gap-[6px] text-[13px] font-bold text-ink">
            <span>Volume TTS: <span className="text-terracotta-deep">{vol}%</span></span>
            <input className="accent-terracotta cursor-pointer"
              type="range"
              min="0"
              max="100"
              step="5"
              value={vol}
              onChange={(e) => {
                const nv = Number(e.target.value);
                setVol(nv);
                voiceVol = nv / 100;
                try { localStorage.setItem("tts-vol", String(nv)); } catch {}
              }}
              
            />
          </label>

          <label className="grid gap-[6px] text-[13px] font-bold text-ink">
            <span>Kecepatan: <span className="text-terracotta-deep">{rate}x</span></span>
            <input className="accent-terracotta cursor-pointer"
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={rate}
              onChange={(e) => {
                const nr = Math.round(Number(e.target.value) * 10) / 10;
                setRate(nr);
                voiceRate = nr;
                try { localStorage.setItem("tts-rate", String(nr)); } catch {}
              }}
              
            />
          </label>
        </div>
        <Alert>Di iPhone: ketuk “Aktifkan suara” sekali agar nama terbaca lantang saat scan.</Alert>
        {cam.streaming && (
          <p className={cn("mt-2 text-[13px] font-bold", scanState === "qr-asing" ? "text-terracotta-dark" : "text-muted-strong")}>
            {scanState === "mencari" && "Mencari QR — arahkan kamera ke kartu QR siswa…"}
            {scanState === "tanpa-decoder" && "Decoder tidak tersedia di browser ini — gunakan input token manual di bawah."}
            {scanState === "qr-asing" && `QR tak dikenal${scanDetail ? `: ${scanDetail}` : ""} — pastikan QR dari kartu siswa.`}
            {scanState === "idle" && ""}
          </p>
        )}
        <video className="w-full max-w-[480px] bg-ink rounded-2xl" ref={videoRef} playsInline muted  />
        <form className="grid gap-[10px] mt-3 max-w-[480px]" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void postToken(manual.trim()); setManual(""); } }}>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Token manual (bila kamera tak mendukung):
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="sms1-…" />
          </label>
          <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" type="submit">Catat hadir</Button></div>
        </form>
        {msg && <p className="font-bold">{msg}</p>}
        {lastScan && (
          <p className={cn("rounded-[14px] px-[14px] py-[10px] font-bold", lastScan.duplicate ? "bg-paper-deep" : "bg-mint")}>
            {lastScan.duplicate ? "Duplikat — " : "Hadir — "}
            {lastScan.name}{lastScan.className ? ` (${lastScan.className})` : ""}
          </p>
        )}
      </Card>

      {/* TOAST POPUP NOTIFIKASI HASIL SCAN */}
      <SwipeToast
        open={!!toastScan}
        onClose={() => setToastScan(null)}
        title={toastScan?.title ?? ""}
        description={toastScan?.desc ?? ""}
        background={toastScan?.duplicate ? "var(--color-cocoa)" : "var(--color-forest)"}
        color="var(--color-cream)"
        fuseColor={toastScan?.duplicate ? "var(--color-sun)" : "var(--color-mint)"}
        width={360}
        radius={18}
        duration={4000}
        fuse="bottom"
        closeButton={false}
      />
    </>
  );
}
