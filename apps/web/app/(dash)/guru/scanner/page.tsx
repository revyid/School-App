"use client";

// Scanner QR absensi (guru): kamera via getUserMedia + BarcodeDetector bila ada,
// fallback input manual. Antrean offline: scan tersimpan di localStorage dan
// di-retry otomatis saat koneksi kembali. Bunyi nama via Web Speech API
// (antre agar tidak tumpang tindih) saat event realtime Socket.io tiba.
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, Btn, Badge, Note, LinkBtn } from "@/components/DashUI";

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

// Antrean suara: ucapkan satu per satu.
// iOS Safari: speechSynthesis butuh pemanasan — daftar suara dimuat async,
// mesin tidur sampai ada gesture, dan suka pause di tengah. Warmup dipanggil
// dari gesture (tombol "Aktifkan suara" / tombol pindai) agar bunyi keluar.
const speakQueue: string[] = [];
let speaking = false;
let voiceWarmed = false;
function warmVoice() {
  try {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const vs = synth.getVoices();
      if (vs.length > 0) voiceWarmed = true;
    };
    load();
    synth.onvoiceschanged = load;
    synth.cancel();
    // Ucapkan diam-diam untuk membangunkan mesin (tanpa antre).
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.lang = "id-ID";
    synth.speak(u);
  } catch { /* abaikan */ }
}
function pickVoice(): SpeechSynthesisVoice | null {
  try {
    const vs = window.speechSynthesis.getVoices();
    if (vs.length === 0) return null;
    return vs.find((v) => v.lang.toLowerCase().startsWith("id")) ?? vs.find((v) => v.lang.toLowerCase().startsWith("en")) ?? vs[0];
  } catch {
    return null;
  }
}
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
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
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "id-ID";
      const v = voiceWarmed ? pickVoice() : null;
      if (v) u.voice = v;
      u.onend = next;
      u.onerror = next;
      window.speechSynthesis.speak(u);
    } catch {
      next();
    }
  };
  next();
}

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [manual, setManual] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [lastScan, setLastScan] = useState<{ name: string; className: string | null; duplicate: boolean } | null>(null);
  const scanning = useRef(false);

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
      setLastScan({ name: d.student?.name ?? "-", className: d.student?.className ?? null, duplicate: !!d.duplicate });
      setMsg(d.duplicate ? `Sudah tercatat (${d.reason === "cooldown" ? "baru saja" : "hari ini"})` : null);
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
  }, []);

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

  // Socket.io realtime (dibroadcast worker): dengar scan sekolah ini.
  useEffect(() => {
    let sock: Socket | null = null;
    try {
      sock = io({ path: "/socket.io/" });
      sock.on("att:scan", (ev: { name: string }) => {
        if (ev?.name) speak(`${ev.name} sudah hadir`);
      });
    } catch { /* abaikan bila socket gagal */ }
    return () => {
      sock?.disconnect();
    };
  }, []);

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
    </>
  );
}

