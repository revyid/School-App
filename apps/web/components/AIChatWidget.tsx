"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/app/lib/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Halo! Saya Asisten AI sekolah. Tanya soal info sekolah, pengumuman, jadwal, tugas, atau materi belajarmu.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function sendMsg(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: String(Date.now()), sender: "user", text };
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
        const aiMsg: ChatMessage = { id: String(Date.now() + 1), sender: "ai", text: d.reply };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const errText = d.error || "Maaf, terjadi masalah pada layanan AI.";
        setMessages((prev) => [...prev, { id: String(Date.now() + 1), sender: "ai", text: `⚠️ ${errText}` }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now() + 1), sender: "ai", text: "⚠️ Masalah koneksi internet. Coba lagi nanti." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999 }}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0f766e",
            color: "#fff",
            border: "none",
            borderRadius: 99,
            padding: "12px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(15,118,110,.35)",
            transition: "transform .2s, background .2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Tanya AI Belajar</span>
        </button>
      )}

      {open && (
        <div
          style={{
            width: "clamp(300px, 90vw, 380px)",
            height: 480,
            background: "#fffdf8",
            border: "1px solid rgba(23,23,22,.18)",
            borderRadius: 20,
            boxShadow: "0 16px 40px rgba(23,23,22,.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              background: "#0f766e",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13 }}>
                AI
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>Asisten Belajar AI</h3>
                <span style={{ fontSize: 11, opacity: 0.85 }}>Privat & Khusus Data Anda</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 20,
                cursor: "pointer",
                padding: "0 4px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* List Pesan */}
          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#faf8f2",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  background: m.sender === "user" ? "#171716" : "#fff",
                  color: m.sender === "user" ? "#fff" : "#171716",
                  border: m.sender === "ai" ? "1px solid rgba(23,23,22,.12)" : "none",
                  borderRadius: m.sender === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#fff",
                  border: "1px solid rgba(23,23,22,.12)",
                  borderRadius: "16px 16px 16px 4px",
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#74746d",
                }}
              >
                AI sedang berpikir…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input */}
          <form
            onSubmit={sendMsg}
            style={{
              padding: 12,
              background: "#fffdf8",
              borderTop: "1px solid rgba(23,23,22,.12)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tanyakan sesuatu…"
              disabled={loading}
              maxLength={500}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 99,
                border: "1px solid rgba(23,23,22,.2)",
                fontSize: 13,
                outline: "none",
                background: "#fff",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "#ccc" : "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 99,
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              Kirim
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
