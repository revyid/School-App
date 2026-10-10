"use client";

import { useState, useRef, useEffect } from "react";
import { BorderBeam } from "border-beam";
import { ThinkingOrb } from "thinking-orbs";
import { api } from "@/app/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const FALLBACK_GREETING: ChatMessage = {
  id: "welcome",
  sender: "ai",
  text: "Halo! Saya Asisten AI sekolah. Tanya soal info sekolah, pengumuman, jadwal, tugas, atau materi belajarmu.",
};

const PLACEHOLDERS = [
  "Tanya jadwal, tugas, pengumuman…",
  "Contoh: tugas apa yang belum saya kumpulkan?",
  "Contoh: kapan asesmen matematika?",
  "Contoh: info PPDB tahun ini?",
];

const QUICK_TAGS = ["Jadwal", "Tugas", "Pengumuman"];

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([FALLBACK_GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  async function loadHistory() {
    if (historyLoaded) return;
    setHistoryLoaded(true);
    try {
      const res = await fetch("/api/ai/chat", { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
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
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) loadHistory();
  }

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, sender: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
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
        const errText = d.error || "Maaf, terjadi masalah pada layanan AI.";
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

  function sendMsg(e: React.FormEvent) {
    e.preventDefault();
    sendText(input);
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
      {!open && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Buka chat AI"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#171716", color: "#fffdf8",
            border: "1px solid rgba(23,23,22,.4)", borderRadius: 99,
            padding: "12px 20px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", boxShadow: "0 8px 24px rgba(23,23,22,.3)",
          }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10.4 5.6V8.6c0 .48.19.94.53 1.27.34.34.8.53 1.27.53s.94-.19 1.27-.53c.34-.33.53-.79.53-1.27V8c0-1.35-.46-2.67-1.3-3.73-.84-1.06-2.02-1.81-3.34-2.11-1.32-.31-2.7-.16-3.92.42-1.23.57-2.22 1.55-2.82 2.77-.6 1.21-.77 2.59-.49 3.92.29 1.32 1.01 2.51 2.06 3.37 1.05.86 2.35 1.34 3.7 1.36 1.36.03 2.68-.41 3.75-1.23M10.4 8c0 1.33-1.07 2.4-2.4 2.4S5.6 9.33 5.6 8 6.67 5.6 8 5.6s2.4 1.07 2.4 2.4Z" stroke="#fffdf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Tanya AI</span>
        </button>
      )}

      {open && (
        <BorderBeam size="md" colorVariant="ocean" strength={0.55} theme="light">
          <div
            style={{
              width: "clamp(300px, 90vw, 400px)", height: 520,
              background: "#fffdf8", borderRadius: 20,
              boxShadow: "0 16px 40px rgba(23,23,22,.2)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(23,23,22,.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ThinkingOrb state={loading ? "composing" : "listening"} size={20} theme="light" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, lineHeight: 1.2, color: "#171716" }}>Asisten AI Sekolah</h3>
                  <span style={{ fontSize: 11, color: "#808388" }}>{loading ? "Menjawab…" : "Siap membantu"}</span>
                </div>
              </div>
              <button type="button" onClick={toggle} aria-label="Tutup chat"
                style={{ background: "transparent", border: "none", color: "#808388", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, background: "#faf8f2" }}>
              {messages.map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
                  {m.sender === "ai" && (
                    <span style={{ flexShrink: 0, marginTop: 2 }}>
                      <ThinkingOrb state="breathing" size={20} theme="light" paused />
                    </span>
                  )}
                  <div style={{
                    background: m.sender === "user" ? "#171716" : "#fff",
                    color: m.sender === "user" ? "#fff" : "#171716",
                    border: m.sender === "ai" ? "1px solid rgba(23,23,22,.12)" : "none",
                    borderRadius: m.sender === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                    padding: "9px 13px", fontSize: 13, lineHeight: 1.55,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", alignSelf: "flex-start", background: "#fff", border: "1px solid rgba(23,23,22,.12)", borderRadius: "4px 16px 16px 16px", padding: "8px 12px" }}>
                  <ThinkingOrb state="searching" size={20} theme="light" />
                  <span style={{ fontSize: 12, color: "#808388" }}>Mencari jawaban…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={sendMsg} style={{ padding: 12, background: "#fffdf8", borderTop: "1px solid rgba(23,23,22,.1)", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {QUICK_TAGS.map((t) => (
                  <button key={t} type="button" onClick={() => sendText(t)}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 99, border: "1px solid rgba(23,23,22,.18)", background: "#fff", color: "#444", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    {t}
                    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ transform: "rotate(90deg)" }}>
                      <path d="M7 11L10 8L7 5" stroke="#8B9099" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="mock-chat-inner" style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(23,23,22,.18)", borderRadius: 14, padding: "8px 8px 8px 12px", background: "#fff" }}>
                <div className="pill" style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: "1px solid rgba(23,23,22,.12)", display: "grid", placeItems: "center" }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10.4 5.6V8.6c0 .48.19.94.53 1.27.34.34.8.53 1.27.53s.94-.19 1.27-.53c.34-.33.53-.79.53-1.27V8c0-1.35-.46-2.67-1.3-3.73-.84-1.06-2.02-1.81-3.34-2.11-1.32-.31-2.7-.16-3.92.42-1.23.57-2.22 1.55-2.82 2.77-.6 1.21-.77 2.59-.49 3.92.29 1.32 1.01 2.51 2.06 3.37 1.05.86 2.35 1.34 3.7 1.36 1.36.03 2.68-.41 3.75-1.23M10.4 8c0 1.33-1.07 2.4-2.4 2.4S5.6 9.33 5.6 8 6.67 5.6 8 5.6s2.4 1.07 2.4 2.4Z" stroke="#808388" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  placeholder={PLACEHOLDERS[phIdx]} disabled={loading} maxLength={1000}
                  style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#171716", minWidth: 0 }}
                />
                <button type="submit" disabled={loading || !input.trim()} aria-label="Kirim"
                  style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", border: "none", background: loading || !input.trim() ? "#e4e4e0" : "#171716", cursor: loading || !input.trim() ? "not-allowed" : "pointer", display: "grid", placeItems: "center" }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 12.6667V3.33333M12.6667 8L8 3.33333L3.33333 8" stroke={loading || !input.trim() ? "#8B8B8B" : "#fffdf8"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </BorderBeam>
      )}
    </div>
  );
}
