"use client";

// Scanner QR absensi (guru): kamera via getUserMedia + BarcodeDetector bila ada,
// fallback input manual. Antrean offline: scan tersimpan di localStorage dan
// di-retry otomatis saat koneksi kembali. Bunyi nama via server TTS Piper ID
// (/api/tts, antre agar tidak tumpang tindih) saat event realtime Socket.io tiba.
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, Note, LinkBtn } from "@/components/DashUI";
import SwipeToast from "@/components/SwipeToast";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [lastScan, setLastScan] = useState<{ name: string; className: string | null; duplicate: boolean } | null>(null);
  const [toastScan, setToastScan] = useState<{ title: string; desc: string; duplicate: boolean } | null>(null);
  // Kontrol volume (0–100%) & kecepatan suara TTS (0.5–2x). Tersimpan per perangkat.
  const [vol, setVol] = useState(100);
  const [rate, setRate] = useState(1);
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
    if (streaming) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setMsg("Kamera tidak tersedia — gunakan input manual di bawah");
    }
  }, [streaming]);

  const stopCamera = useCallback(() => {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setStreaming(false);
  }, []);

  useEffect(() => () => {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Loop deteksi: BarcodeDetector tiap 500ms; token sms1-* langsung dipost.
  useEffect(() => {
    if (!streaming) return;
    let alive = true;
    const loop = async () => {
      while (alive) {
        await new Promise((r) => setTimeout(r, 500));
        if (!alive || scanning.current) continue;
        try {
          const BD = (window as unknown as { BarcodeDetector?: new (o: object) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
          if (!BD || !videoRef.current) continue;
          const det = new BD({ formats: ["qr_code"] });
          const codes = await det.detect(videoRef.current);
          const val = codes[0]?.rawValue?.trim();
          if (val && /^sms1-[0-9a-f]{32}$/.test(val)) {
            scanning.current = true;
            await postToken(val);
            setTimeout(() => {
              scanning.current = false;
            }, 2000);
          }
        } catch { /* abaikan frame gagal */ }
      }
    };
    loop();
    return () => {
      alive = false;
    };
  }, [streaming, postToken]);

  return (
    <>
      <PageHead
        kicker="Absensi"
        title="Scanner kehadiran"
        desc="Arahkan kamera ke kartu QR siswa. Bisa offline, antrean terkirim otomatis."
        right={<LinkBtn href="/guru/kehadiran">Lihat rekap hari ini</LinkBtn>}
      />
      <Panel style={{ maxWidth: 640 }}>
        {offlineCount > 0 && (
          <p style={{ margin: "0 0 12px" }}><Badge status="PENDING">Antrean offline: {offlineCount} (otomatis dikirim saat online)</Badge></p>
        )}
        <Toolbar>
          {!streaming
            ? <Btn type="button" kind="dark" onClick={() => { warmVoice(); void startCamera(); }}>Nyalakan kamera</Btn>
            : <Btn kind="ghost" type="button" onClick={stopCamera}>Matikan kamera</Btn>}
          <Btn kind="ghost" type="button" onClick={warmVoice}>Aktifkan suara</Btn>
        </Toolbar>

        {/* KONTROL VOLUME & KECEPATAN SUARA TTS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, background: "rgba(23,23,22,.04)", border: "1px solid rgba(23,23,22,.1)", borderRadius: 14, padding: "12px 16px", margin: "12px 0 16px" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#171716" }}>
            <span>Volume TTS: <span style={{ color: "#e85e43" }}>{vol}%</span></span>
            <input
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
              style={{ accentColor: "#e85e43", cursor: "pointer" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700, color: "#171716" }}>
            <span>Kecepatan: <span style={{ color: "#e85e43" }}>{rate}x</span></span>
            <input
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
              style={{ accentColor: "#e85e43", cursor: "pointer" }}
            />
          </label>
        </div>
        <Note>Di iPhone: ketuk “Aktifkan suara” sekali agar nama terbaca lantang saat scan.</Note>
        <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 480, background: "#171716", borderRadius: 16 }} />
        <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void postToken(manual.trim()); setManual(""); } }} style={{ display: "grid", gap: 10, marginTop: 12, maxWidth: 480 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Token manual (bila kamera tak mendukung):
            <TextInput value={manual} onChange={(e) => setManual(e.target.value)} placeholder="sms1-…" />
          </label>
          <Toolbar><Btn type="submit">Catat hadir</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
        {lastScan && (
          <p style={{ padding: "10px 14px", borderRadius: 14, background: lastScan.duplicate ? "#eeeadd" : "#aec6a4", fontWeight: 700 }}>
            {lastScan.duplicate ? "Duplikat — " : "Hadir — "}
            {lastScan.name}{lastScan.className ? ` (${lastScan.className})` : ""}
          </p>
        )}
      </Panel>

      {/* TOAST POPUP NOTIFIKASI HASIL SCAN */}
      <SwipeToast
        open={!!toastScan}
        onClose={() => setToastScan(null)}
        title={toastScan?.title ?? ""}
        description={toastScan?.desc ?? ""}
        background={toastScan?.duplicate ? "#3d3215" : "#1a3b1e"}
        color="#fff"
        fuseColor={toastScan?.duplicate ? "#f5c94a" : "#4ade80"}
        width={360}
        radius={18}
        duration={4000}
        fuse="bottom"
        closeButton={false}
      />
    </>
  );
}
