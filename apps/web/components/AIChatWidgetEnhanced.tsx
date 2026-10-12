"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BorderBeam } from "border-beam";
import { api } from "@/app/lib/api";
import GrokAvatar from "@/components/GrokAvatar";
import RaiMarkdown from "./RaiMarkdown";

interface ChatMessage { id: string; sender: "user" | "ai"; text: string }
type Mood = "idle" | "thinking" | "happy" | "concerned" | "angry" | "wary" | "confused";
const GREETING: ChatMessage = { id: "welcome", sender: "ai", text: "Halo! Saya RAI, Asisten AI sekolah. Saya bisa membantu menjelaskan materi, mencari info yang tersedia untuk akunmu, dan mengarahkanmu ke fitur yang tepat." };

// Kata kasar → angry; topik keamanan/data → wary; jawaban gagal/tak tahu → confused.
const RUDE_WORDS = ["goblok", "tolol", "bodoh", "idiot", "anjing", "bangsat", "bego", "kampret", "jancuk", "asu", "bajingan", "brengsek", "sialan", "keparat", "dungu", "najis"];
const SECURITY_WORDS = ["keamanan", "password", "kata sandi", "sandi", "hack", "retas", "bocor", "kebocoran", "privasi", "data pribadi", "phising", "phishing", "aman dari", "keamanan data", "virus", "malware"];
function moodFromExchange(userText: string, aiText: string, failed: boolean): Mood {
  if (failed) return "concerned";
  const u = userText.toLowerCase();
  if (RUDE_WORDS.some((w) => u.includes(w))) return "angry";
  if (SECURITY_WORDS.some((w) => u.includes(w))) return "wary";
  const a = aiText.toLowerCase();
  if (a.includes("maaf") && /(belum bisa|tidak tahu|kurang tahu|tidak yakin|coba lagi|koneksi bermasalah|gagal merespons)/.test(a)) return "confused";
  return "happy";
}
const PLACEHOLDERS = ["Tanya jadwal, tugas, pengumuman…", "Contoh: bantu pahami materi matematika", "Contoh: apa yang perlu saya kerjakan hari ini?", "Contoh: bagaimana cara mengumpulkan tugas?"];
const QUICK_TAGS = ["Jadwal", "Tugas", "Pengumuman"];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update(); mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export default function AIChatWidgetEnhanced() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [placeholder, setPlaceholder] = useState(0);
  const [failed, setFailed] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [showTrust, setShowTrust] = useState(true);
  const [streamText, setStreamText] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/chat", { cache: "no-store" }).then((r) => r.json().catch(() => ({}))).then((data) => {
      if (!alive) return;
      setEnabled(data.enabled === true);
      if (Array.isArray(data.messages) && data.messages.length) setMessages(data.messages.map((m: { sender: string; text: string }, i: number) => ({ id: `h-${i}`, sender: m.sender === "user" ? "user" : "ai", text: m.text })));
      setLoaded(true);
    }).catch(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setPlaceholder((i) => (i + 1) % PLACEHOLDERS.length), 3200); return () => window.clearInterval(timer); }, []);

  async function loadHistory() {
    if (loaded) return;
    setLoaded(true);
    const response = await fetch("/api/ai/chat", { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    setEnabled(data?.enabled === true);
    if (Array.isArray(data?.messages) && data.messages.length) setMessages(data.messages.map((m: { sender: string; text: string }, i: number) => ({ id: `h-${i}`, sender: m.sender === "user" ? "user" : "ai", text: m.text })));
  }
  function toggle() { setOpen((value) => { const next = !value; if (next) void loadHistory(); return next; }); }
  // Baca SSE: server kirim {token} per potong + [DONE]. Kembalikan null bila bukan SSE.
  async function readStream(res: Response, onToken: (t: string) => void): Promise<boolean> {
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/event-stream") || !res.body) return false;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let gotToken = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          if (typeof j.token === "string" && j.token) { onToken(j.token); gotToken = true; }
          else if (typeof j.error === "string" && j.error) throw new Error(j.error);
        } catch (e: any) {
          if (e instanceof Error && !e.message.startsWith("{")) throw e;
        }
      }
    }
    return gotToken;
  }

  async function send(raw: string) {
    const text = raw.trim(); if (!text || loading) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: "user", text }]); setInput(""); setLoading(true); setFailed(false);
    setStreamText("");
    const fail = (msg: string) => { setFailed(true); setMood("concerned"); setMessages((prev) => [...prev, { id: `n-${Date.now()}`, sender: "ai", text: msg }]); };
    try {
      // Coba stream dulu (POST SSE). Query ?stream=1 memberitahu server.
      const token = sessionStorage.getItem("csrf") ?? "";
      const res = await fetch("/api/ai/chat?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-csrf-token": token } : {}) },
        body: JSON.stringify({ message: text }),
      });
      let full = "";
      if (res.ok) {
        const streamed = await readStream(res, (t) => { full += t; setStreamText(full); }).catch(() => false);
        if (streamed && full.trim()) {
          setMood(moodFromExchange(text, full, false));
          setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: "ai", text: full }]);
          setStreamText("");
          return;
        }
      }
      // Fallback non-stream: animasi fade per kata saat jawaban tampil.
      const response = res.ok && !res.headers.get("content-type")?.includes("text/event-stream")
        ? res
        : await api("/api/ai/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = await response.json().catch(() => ({}));
      const reply: string = response.ok && data.reply ? data.reply : data.error || "Maaf, layanan AI belum bisa menjawab sekarang.";
      const id = `a-${Date.now()}`;
      if (!response.ok) { fail(reply); return; }
      if (reduced) {
        setMood(moodFromExchange(text, reply, false));
        setMessages((prev) => [...prev, { id, sender: "ai", text: reply }]);
        return;
      }
      // Fade per kata: tampilkan progres kata demi kata (±30 mdt/kata).
      const words = reply.split(/(\s+)/);
      setMessages((prev) => [...prev, { id, sender: "ai", text: "" }]);
      let shown = 0;
      for (let i = 0; i < words.length; i++) {
        shown = i + 1;
        const partial = words.slice(0, shown).join("");
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: partial } : m)));
        await new Promise((r) => setTimeout(r, 30));
      }
      setMood(moodFromExchange(text, reply, false));
    } catch { fail("Maaf, koneksi bermasalah. Periksa jaringan lalu coba lagi."); }
    finally { setLoading(false); setStreamText(""); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  async function resetChat() {
    setMessages([GREETING]); setMood("idle"); setFailed(false); setStreamText("");
    // Hapus riwayat server milik user ini; abaikan bila tamu (401).
    await fetch("/api/ai/chat", { method: "DELETE", headers: sessionStorage.getItem("csrf") ? { "x-csrf-token": sessionStorage.getItem("csrf") as string } : {} }).catch(() => {});
  }

  // Auto-close: klik di luar panel menutup chat (kecuali klik launcher).
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }, [messages, loading, open, reduced, streamText]);

  if (!enabled) return null;
  const liveMood: Mood = loading ? "thinking" : mood;

  return <div className="ai-enhanced-root" ref={rootRef}>
    {!open && <button className="ai-enhanced-launcher" type="button" onClick={toggle} aria-label="Buka chat RAI"><GrokAvatar size={35} mood={liveMood} /><span>Tanya RAI</span><i aria-hidden="true" /></button>}
    {open && <BorderBeam size="md" colorVariant="colorful" strength={0.7} theme="light" borderRadius={24} active={loading && !reduced}>
      <section className="ai-enhanced-panel" aria-label="Chat RAI">
        <header className="ai-enhanced-header"><div className="ai-enhanced-identity"><GrokAvatar size={48} mood={liveMood} /><div><h2>RAI</h2><p>{loading ? "Sedang berpikir…" : "Siap membantu dengan aman"}</p></div></div><div style={{ display: "flex", gap: 4 }}><button type="button" onClick={() => void resetChat()} aria-label="Hapus riwayat chat" title="Hapus riwayat">⟲</button><button type="button" onClick={toggle} aria-label="Tutup chat">×</button></div></header>
        {showTrust && <div className="ai-enhanced-trust"><span /> Akses mengikuti akun dan pengaturan sekolah · Jangan kirim data sensitif <button type="button" onClick={() => setShowTrust(false)} aria-label="Tutup pemberitahuan">×</button></div>}
        <div className="ai-enhanced-messages" aria-live="polite">
          {messages.map((message) => <div className={`ai-enhanced-row ${message.sender}`} key={message.id}><div className={`ai-enhanced-bubble ${message.sender}`}>{message.sender === "ai" ? <RaiMarkdown text={message.text} /> : message.text}</div></div>)}
          {streamText && !messages.some((m) => m.sender === "ai" && m.text === streamText) && <div className="ai-enhanced-row ai"><div className="ai-enhanced-bubble ai ai-stream"><RaiMarkdown text={streamText} /></div></div>}
          {loading && !streamText && <div className="ai-enhanced-row ai"><GrokAvatar size={26} mood="thinking" interactive={false} /><div className="ai-enhanced-bubble ai">Mencari jawaban…</div></div>}
          <div ref={endRef} />
        </div>
        <form className="ai-enhanced-compose" onSubmit={submit}><div className="ai-enhanced-input"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder={PLACEHOLDERS[placeholder]} maxLength={1000} disabled={loading} aria-label="Tulis pertanyaan" /><button type="submit" disabled={loading || !input.trim()} aria-label="Kirim">↑</button></div></form>
      </section>
    </BorderBeam>}
    <style jsx global>{`
      .ai-enhanced-root{position:fixed;right:20px;bottom:20px;z-index:9999;font-family:inherit}.ai-enhanced-launcher{display:flex;align-items:center;gap:9px;padding:9px 17px 9px 9px;border:1px solid rgba(23,23,22,.45);border-radius:999px;background:#171716;color:#fffdf8;font:700 14px inherit;cursor:pointer;box-shadow:0 10px 28px rgba(23,23,22,.26);transition:transform .2s ease}.ai-enhanced-launcher:hover{transform:translateY(-2px)}.ai-enhanced-launcher i{width:7px;height:7px;border-radius:50%;background:#55d6b4;box-shadow:0 0 0 4px rgba(85,214,180,.15);animation:ai-enhanced-ping 2s ease-in-out infinite}.ai-enhanced-panel{width:min(410px,92vw);height:min(640px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;border-radius:24px;background:#fffdf8;color:#171716;box-shadow:0 20px 60px rgba(23,23,22,.24)}.ai-enhanced-header{display:flex;justify-content:space-between;align-items:center;padding:13px 16px 11px;border-bottom:1px solid rgba(23,23,22,.1)}.ai-enhanced-identity{display:flex;align-items:center;gap:10px}.ai-enhanced-identity h2{margin:0;font-size:14px;font-weight:850;line-height:1.2}.ai-enhanced-identity p{margin:3px 0 0;font-size:11px;color:#6f7477}.ai-enhanced-header>button{border:0;background:transparent;color:#767a7c;font-size:26px;line-height:1;cursor:pointer}.ai-enhanced-header>div button{border:1px solid rgba(23,23,22,.16);background:#fff;color:#555;border-radius:999px;min-width:28px;height:28px;font-size:14px;line-height:1;cursor:pointer}.ai-enhanced-trust{padding:7px 15px;font-size:10px;color:#4c7771;background:#edf8f4;border-bottom:1px solid #d8eee8}.ai-enhanced-trust span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#1ca88f;margin-right:4px}.ai-enhanced-trust button{border:0;background:transparent;color:#4c7771;cursor:pointer;font-size:12px;margin-left:6px}.ai-enhanced-messages{flex:1;min-height:0;display:flex;flex-direction:column;gap:11px;overflow-y:auto;padding:16px 14px;background:linear-gradient(180deg,#fbfaf6,#f6f7f2)}.ai-enhanced-row{display:flex;align-items:flex-start;gap:7px;max-width:93%}.ai-enhanced-row.user{align-self:flex-end}.ai-enhanced-bubble{padding:10px 13px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word}.ai-enhanced-bubble.ai{border:1px solid rgba(23,23,22,.1);border-radius:5px 16px 16px 16px;background:#fff}.ai-enhanced-bubble.user{border-radius:16px 16px 5px 16px;background:#171716;color:#fff}.ai-enhanced-bubble.typing{display:flex;align-items:center;gap:4px;color:#7b8182;font-size:11px}.typing span{width:5px;height:5px;border-radius:50%;background:#299e91;animation:ai-enhanced-dot 1s ease-in-out infinite}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}.ai-enhanced-compose{display:grid;gap:8px;padding:11px 12px;border-top:1px solid rgba(23,23,22,.1);background:#fffdf8}.ai-enhanced-quick{display:flex;gap:6px}.ai-enhanced-quick button{padding:5px 11px;border:1px solid rgba(23,23,22,.16);border-radius:999px;background:#fff;color:#555;font-size:11px;font-weight:700;cursor:pointer}.ai-enhanced-input{display:flex;gap:8px;align-items:center;padding:7px 7px 7px 12px;border:1px solid rgba(23,23,22,.2);border-radius:15px;background:transparent}.ai-enhanced-input:focus-within{border-color:#2b9b8e;box-shadow:0 0 0 3px rgba(43,155,142,.1)}.ai-enhanced-input input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#171716;font:13px inherit}.ai-enhanced-input button{width:31px;height:31px;border:0;border-radius:50%;background:#171716;color:#fff;font-size:19px;cursor:pointer}.ai-enhanced-input button:disabled{background:#e4e5df;color:#8b8b8b;cursor:not-allowed}@keyframes ai-enhanced-ping{0%,100%{opacity:.65;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}@keyframes ai-enhanced-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}@media (prefers-reduced-motion:reduce){.ai-enhanced-launcher i,.typing span{animation:none!important}}@media(max-width:480px){.ai-enhanced-root{right:10px;bottom:10px}}
    `}</style>
  </div>;
}
