"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/app/lib/api";
import RaiAvatar from "@/components/RaiAvatar";
import RaiMarkdown from "./RaiMarkdown";

interface ChatMessage { id: string; sender: "user" | "ai"; text: string }
type Mood = "idle" | "thinking" | "happy" | "concerned" | "angry" | "wary" | "confused";
const GREETING: ChatMessage = { id: "welcome", sender: "ai", text: "Halo! Saya RAI R1, asisten AI sekolah. Saya bisa membantu menjelaskan materi, mencari info yang tersedia untuk akunmu, dan mengarahkanmu ke fitur yang tepat." };

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

// Sembunyi saat siswa sedang mengerjakan tugas/asesmen (halaman detail ber-id);
// tetap tampil di daftar /siswa/kelasku dan halaman lain.
const TASK_PAGE_RE = /\/siswa\/kelasku\/(asesmen|tugas)\//;

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
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
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
  const closeTimer = useRef<number | null>(null);
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
  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }, []);

  async function loadHistory() {
    if (loaded) return;
    setLoaded(true);
    const response = await fetch("/api/ai/chat", { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => ({}));
    setEnabled(data?.enabled === true);
    if (Array.isArray(data?.messages) && data.messages.length) setMessages(data.messages.map((m: { sender: string; text: string }, i: number) => ({ id: `h-${i}`, sender: m.sender === "user" ? "user" : "ai", text: m.text })));
  }
  function openChat() {
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
    setClosing(false);
    setOpen(true);
    void loadHistory();
  }
  function closeChat() {
    if (reduced) { setOpen(false); setClosing(false); return; }
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => { setOpen(false); setClosing(false); closeTimer.current = null; }, 110);
  }
  function toggle() { if (open && !closing) closeChat(); else openChat(); }
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
      const reply: string = response.ok && data.reply ? data.reply : data.error || "Maaf, RAI R1 belum bisa menjawab sekarang.";
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
      if (rootRef.current && !rootRef.current.contains(t)) closeChat();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, reduced]);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); }, [messages, loading, open, reduced, streamText]);

  if (TASK_PAGE_RE.test(pathname ?? "")) return null;
  if (!enabled) return null;
  const liveMood: Mood = loading ? "thinking" : mood;

  return <div className="ai-enhanced-root" ref={rootRef}>
    {!open && <button className="ai-enhanced-launcher" type="button" onClick={toggle} aria-label="Buka chat RAI R1"><RaiAvatar size={35} mood={liveMood} /><span>Tanya RAI R1</span><i aria-hidden="true" /></button>}
    {open && (
      <section className="ai-enhanced-panel" data-closing={closing ? "true" : undefined} aria-label="Chat RAI R1">
        <header className="ai-enhanced-header"><div className="ai-enhanced-identity"><RaiAvatar size={48} mood={liveMood} /><div><h2>RAI R1<span>by RevyID</span></h2><p>{loading ? "Sedang berpikir…" : "Siap membantu dengan aman"}</p></div></div><div className="ai-enhanced-actions"><button type="button" onClick={() => void resetChat()} aria-label="Hapus riwayat chat" title="Hapus riwayat">⟲</button><button type="button" onClick={toggle} aria-label="Tutup chat">×</button></div></header>
        {showTrust && <div className="ai-enhanced-trust"><span /> Akses mengikuti akun dan pengaturan sekolah · Jangan kirim data sensitif <button type="button" onClick={() => setShowTrust(false)} aria-label="Tutup pemberitahuan">×</button></div>}
        <div className="ai-enhanced-messages" aria-live="polite">
          {messages.map((message) => <div className={`ai-enhanced-row ${message.sender}`} key={message.id}><div className={`ai-enhanced-bubble ${message.sender}`}>{message.sender === "ai" ? <RaiMarkdown text={message.text} /> : message.text}</div></div>)}
          {streamText && !messages.some((m) => m.sender === "ai" && m.text === streamText) && <div className="ai-enhanced-row ai"><div className="ai-enhanced-bubble ai ai-stream"><RaiMarkdown text={streamText} /></div></div>}
          {loading && !streamText && <div className="ai-enhanced-row ai"><RaiAvatar size={26} mood="thinking" interactive={false} /><div className="ai-enhanced-bubble ai">Mencari jawaban…</div></div>}
          <div ref={endRef} />
        </div>
        <form className="ai-enhanced-compose" onSubmit={submit}><div className="ai-enhanced-input"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder={PLACEHOLDERS[placeholder]} maxLength={1000} disabled={loading} aria-label="Tulis pertanyaan" /><button type="submit" disabled={loading || !input.trim()} aria-label="Kirim">↑</button></div></form>
      </section>
    )}
    <style jsx global>{`
      .ai-enhanced-root{position:fixed;right:20px;bottom:20px;z-index:9999;font-family:inherit}
      .ai-enhanced-launcher{display:flex;align-items:center;gap:9px;padding:9px 17px 9px 9px;border:1px solid var(--color-ink);border-radius:999px;background:var(--color-ink);color:var(--color-cream);font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;box-shadow:3px 3px 0 rgba(23,23,22,.28),0 12px 30px rgba(23,23,22,.22);transition:transform .18s ease,box-shadow .18s ease}
      .ai-enhanced-launcher:hover{transform:translateY(-2px)}
      .ai-enhanced-launcher:active{transform:scale(.965)}
      .ai-enhanced-launcher i{width:8px;height:8px;border-radius:50%;background:var(--color-sun);box-shadow:0 0 0 4px rgba(245,201,74,.22);animation:ai-enhanced-ping 2.4s ease-in-out infinite}
      @keyframes ai-enhanced-ping{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
      .ai-enhanced-panel{width:min(410px,92vw);height:min(640px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;border-radius:24px;background:var(--color-cream);color:var(--color-ink);border:1px solid var(--color-ink);box-shadow:4px 4px 0 rgba(23,23,22,.18),0 24px 60px rgba(23,23,22,.22);transform-origin:bottom right;animation:ai-enhanced-pop 160ms cubic-bezier(.34,1.3,.5,1)}
      .ai-enhanced-panel[data-closing="true"]{transition:opacity 110ms ease-out,scale 110ms ease-out,translate 110ms ease-out;opacity:0;scale:.96;translate:0 4px}
      @keyframes ai-enhanced-pop{from{opacity:0;scale:.96;translate:0 4px}to{opacity:1;scale:1;translate:0 0}}
      .ai-enhanced-header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px 14px 11px 16px;border-bottom:1px solid var(--color-line);background:var(--color-cream)}
      .ai-enhanced-identity{display:flex;align-items:center;gap:10px;min-width:0}
      .ai-enhanced-identity h2{margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.25}
      .ai-enhanced-identity h2 span{display:block;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted-strong)}
      .ai-enhanced-identity p{margin:2px 0 0;font-size:11px;color:var(--color-muted-strong)}
      .ai-enhanced-actions{display:flex;gap:6px}
      .ai-enhanced-actions button{border:1px solid var(--color-ink);background:var(--color-cream);color:var(--color-ink);border-radius:999px;min-width:30px;height:30px;padding:0 7px;font-size:14px;line-height:1;cursor:pointer;transition:transform .15s ease,background .15s ease}
      .ai-enhanced-actions button:hover{background:var(--color-paper-deep);transform:translateY(-1px)}
      .ai-enhanced-trust{display:flex;align-items:center;gap:6px;padding:8px 12px 8px 14px;font-size:11px;line-height:1.5;color:var(--color-sage-deep);background:var(--color-sage);border-bottom:1px solid var(--color-line)}
      .ai-enhanced-trust span{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:var(--color-olive-deep)}
      .ai-enhanced-trust button{margin-left:auto;flex:0 0 auto;border:0;background:transparent;color:var(--color-sage-deep);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px}
      .ai-enhanced-messages{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding:16px 14px;background:var(--color-paper)}
      .ai-enhanced-row{display:flex;gap:8px;align-items:flex-end}
      .ai-enhanced-row.ai{justify-content:flex-start}
      .ai-enhanced-row.user{justify-content:flex-end}
      .ai-enhanced-bubble{max-width:85%;padding:9px 13px;font-size:13.5px;line-height:1.6;overflow-wrap:anywhere}
      .ai-enhanced-bubble.ai{background:var(--color-cream);color:var(--color-ink);border:1px solid var(--color-line);border-radius:4px 16px 16px 16px}
      .ai-enhanced-bubble.user{background:var(--color-ink);color:var(--color-cream);border:1px solid var(--color-ink);border-radius:16px 16px 4px 16px}
      .ai-enhanced-compose{padding:12px 14px 14px;background:var(--color-cream);border-top:1px solid var(--color-line)}
      .ai-enhanced-input{display:flex;align-items:center;gap:8px;padding:5px 5px 5px 15px;border:1px solid var(--color-ink);border-radius:999px;background:var(--color-paper)}
      .ai-enhanced-input input{flex:1;min-width:0;border:0;background:transparent;color:var(--color-ink);font-size:14px;padding:8px 0}
      .ai-enhanced-input input::placeholder{color:var(--color-muted-strong)}
      .ai-enhanced-input input:disabled{opacity:.6}
      .ai-enhanced-input input:focus{outline:none}
      .ai-enhanced-input button{flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:1px solid var(--color-terracotta-deep);background:var(--color-terracotta-dark);color:var(--color-cream);font-size:16px;line-height:1;cursor:pointer;transition:transform .15s ease,background .15s ease}
      .ai-enhanced-input button:hover:not(:disabled){background:var(--color-terracotta-deep);transform:translateY(-1px)}
      .ai-enhanced-input button:disabled{background:var(--color-paper-deep);border-color:var(--color-line);color:var(--color-muted-strong);cursor:default}
      .ai-enhanced-launcher:focus-visible,.ai-enhanced-actions button:focus-visible,.ai-enhanced-trust button:focus-visible,.ai-enhanced-input button:focus-visible{outline:2px solid var(--color-olive-deep);outline-offset:2px}
      .ai-enhanced-input:focus-within{outline:2px solid var(--color-olive-deep);outline-offset:2px}
      @media (prefers-reduced-motion:reduce){.ai-enhanced-panel{animation:none}.ai-enhanced-panel[data-closing="true"]{transition:none}.ai-enhanced-launcher i{animation:none}.ai-enhanced-launcher:hover{transform:none}}
    `}</style>
  </div>;
}
