"use client";

// Widget chat RAI mengambang (gaya Orbit ringkas): tombol orb pojok kanan bawah,
// panel chat, pesan user bubble kanan, pesan RAI kiri dengan markdown,
// composer pill + tombol kirim bundar. Tanpa pilih mode/model.
import { useState, useRef, useEffect, useCallback } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/app/lib/api";
import RaiMarkdown from "./RaiMarkdown";

import { Glyph } from "./Glyph";
interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const FALLBACK_GREETING: ChatMessage = {
  id: "welcome",
  sender: "ai",
  text: "Halo, saya **RAI**. Tanya soal info sekolah, pengumuman, cara pakai fitur, atau materi belajarmu.",
};

const PLACEHOLDERS = [
  "Tanya RAI: jadwal, tugas, pengumuman…",
  "Contoh: bagaimana cara kumpulkan tugas?",
  "Contoh: di mana kartu QR saya?",
  "Contoh: jelaskan fotosintesis?",
];

const QUICK_TAGS = ["Jadwal", "Tugas", "Pengumuman"];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export default function AIChatWidget() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([FALLBACK_GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/chat", { cache: "no-store" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!active) return;
        setEnabled(data.enabled === true);
        if (data.enabled === true && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map((m: { sender: string; text: string }, i: number) => ({
            id: `h-${i}`,
            sender: m.sender === "user" ? "user" : "ai",
            text: m.text,
          })));
        }
        setHistoryLoaded(true);
      })
      .catch(() => { if (active) setHistoryLoaded(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  function resizeTextarea() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  useEffect(() => {
    if (open) resizeTextarea();
  }, [open, input]);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    setHistoryLoaded(true);
    try {
      const res = await fetch("/api/ai/chat", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      setEnabled(d.enabled === true);
      if (res.ok && Array.isArray(d.messages) && d.messages.length > 0) {
        setMessages(
          d.messages.map((m: { sender: string; text: string }, i: number) => ({
            id: `h-${i}`,
            sender: m.sender === "user" ? "user" : "ai",
            text: m.text,
          }))
        );
      }
    } catch {
      // tamu / belum login: pakai sapaan default
    }
  }, [historyLoaded]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadHistory();
  }

  async function clearHistory() {
    try {
      await api("/api/ai/chat", { method: "DELETE" });
      setMessages([FALLBACK_GREETING]);
    } catch {
      // abaikan: riwayat lokal tetap, tidak mengganggu
    }
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    requestAnimationFrame(resizeTextarea);
    setLoading(true);
    try {
      const res = await api("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.reply) {
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: "ai", text: d.reply }]);
      } else {
        const errText = d.error || "terjadi masalah pada layanan AI.";
        setMessages((prev) => [...prev, { id: `e-${Date.now()}`, sender: "ai", text: `Maaf, ${errText}` }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `n-${Date.now()}`, sender: "ai", text: "Maaf, koneksi internet bermasalah. Periksa jaringan lalu coba lagi." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText(input);
    }
  }

  const canSend = !loading && !!input.trim();

  function sendMsg(e: React.FormEvent) {
    e.preventDefault();
    void sendText(input);
  }

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      {!open && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Buka chat RAI"
          title="Tanya RAI"
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            padding: 7,
            cursor: "pointer",
            background: "#171716",
            border: "1px solid rgba(23,23,22,.4)",
            boxShadow: "0 8px 30px rgba(0,0,0,.4)",
          }}
        >
          <ThinkingOrb
            state="breathing"
            size={32}
            theme="dark"
            paused={reducedMotion}
            aria-hidden="true"
          />
        </button>
      )}

      {open && (
        <section
          aria-label="Chat RAI"
          style={{
            width: "min(400px, calc(100vw - 40px))",
            height: "min(580px, calc(100dvh - 130px))",
            background: "#fffdf8",
            border: "1px solid rgba(23,23,22,.14)",
            borderRadius: 26,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,.35)",
            overflow: "hidden",
          }}
        >
          <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid rgba(23,23,22,.1)" }}>
            <ThinkingOrb
              state={loading ? "composing" : "breathing"}
              size={20}
              theme="light"
              paused={!loading && reducedMotion}
              aria-hidden="true"
            />
            <b style={{ flex: 1, textAlign: "left", fontWeight: 600, fontSize: 14, color: "#171716" }}>
              RAI
              <span style={{ display: "block", fontSize: 11, fontWeight: 400, color: "#808388" }}>
                {loading ? "Menjawab…" : "Siap membantu"}
              </span>
            </b>
            <button
              type="button"
              onClick={() => void clearHistory()}
              aria-label="Bersihkan riwayat chat"
              title="Bersihkan riwayat chat"
              style={{ background: "transparent", border: "none", color: "#808388", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "4px 6px", borderRadius: 8 }}
            >
              Bersihkan
            </button>
            <button type="button" onClick={toggle} aria-label="Tutup chat"
              style={{ background: "transparent", border: "none", color: "#808388", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>
              <Glyph name="close" size={18} />
            </button>
          </header>

          <div style={{ flex: 1, padding: "14px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, background: "#faf8f2" }}>
            {messages.map((m) => m.sender === "user" ? (
              <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{
                  maxWidth: "85%",
                  background: "#171716",
                  color: "#fff",
                  borderRadius: "18px 18px 4px 18px",
                  padding: "11px 15px", fontSize: 13, lineHeight: 1.55,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} style={{
                maxWidth: "100%",
                color: "#2b2b28",
                fontSize: 13, lineHeight: 1.65,
                wordBreak: "break-word",
              }}>
                <RaiMarkdown text={m.text} />
              </div>
            ))}
            {loading && (
              <div
                role="status"
                style={{ display: "flex", gap: 10, alignItems: "center", alignSelf: "flex-start", background: "#fff", border: "1px solid rgba(23,23,22,.12)", borderRadius: "4px 16px 16px 16px", padding: "8px 14px 8px 8px" }}
              >
                <span style={{ width: 44, height: 44, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <ThinkingOrb state="searching" size={32} theme="light" speed={reducedMotion ? 0 : 1} paused={reducedMotion} aria-label="RAI sedang mencari jawaban" />
                </span>
                <span style={{ fontSize: 12, color: "#808388" }}>RAI berpikir…</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMsg} aria-busy={loading} style={{ margin: "0 14px 14px", padding: "12px 14px", borderRadius: 24, border: "1px solid rgba(23,23,22,.14)", background: "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              {QUICK_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => void sendText(t)}
                  style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 99, border: "1px solid rgba(23,23,22,.18)", background: "#fff", color: "#444", cursor: "pointer" }}>
                  {t}
                </button>
              ))}
            </div>

            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={PLACEHOLDERS[phIdx]}
              disabled={loading}
              maxLength={1000}
              aria-label="Tanya RAI"
              style={{ width: "100%", border: "none", outline: "none", resize: "none", background: "transparent", color: "#171716", font: "inherit", fontSize: 16, minHeight: 44, maxHeight: 120, padding: "2px" }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#8a8a82" }}>RAI menjawab dengan markdown</span>
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Kirim"
                style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(23,23,22,.18)", background: canSend ? "#171716" : "#fff", color: canSend ? "#fffdf8" : "#8B8B8B", cursor: canSend ? "pointer" : "not-allowed", display: "grid", placeItems: "center" }}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 12.6667V3.33333M12.6667 8L8 3.33333L3.33333 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
