'use client';

// Form CTA anonim publik — tanpa login (masyarakat umum)
import { useState } from "react";
import SwipeToast from "./SwipeToast";

export default function AnonimForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [alias, setAlias] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const res = await fetch("/api/anonim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, message, senderAlias: alias || undefined }),
    }).catch(() => null);

    const d = (await res?.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };

    if (res?.ok && d.success) {
      setToast({ title: "Terkirim", body: d.message ?? "Pesan anonim Anda sudah diteruskan ke sekolah." });
      setSubject("");
      setMessage("");
      setAlias("");
    } else {
      setToast({ title: "Gagal terkirim", body: d.error ?? `Gagal (${res?.status ?? "jaringan"})` });
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(23,23,22,.25)",
    background: "#fffdf8",
    padding: "10px 14px",
    fontSize: 14,
    color: "#171716",
  };

  return (
    <>
      <form
        onSubmit={kirim}
        style={{
          display: "grid",
          gap: 14,
          background: "#faf8f2",
          border: "1px solid rgba(23,23,22,.14)",
          borderRadius: 20,
          padding: "24px 22px",
        }}
      >
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
          Nama panggilan (opsional):
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="mis. Warga Peduli"
            maxLength={60}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
          Subjek:
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="mis. Usulan kantin sehat"
            required
            maxLength={120}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
          Isi pesan:
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis aspirasi, laporan, atau saran Anda…"
            required
            rows={5}
            maxLength={2000}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? "#a0a096" : "#171716",
            color: "#fffdf8",
            padding: "12px 20px",
            borderRadius: 99,
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: loading ? "wait" : "pointer",
            transition: "background .2s",
          }}
        >
          {loading ? "Mengirim…" : "Kirim Anonim"}
        </button>
      </form>

      {/* Toast notifikasi status kirim (tema terang) */}
      <SwipeToast
        open={!!toast}
        onClose={() => setToast(null)}
        title={toast?.title ?? ""}
        description={toast?.body ?? ""}
        background="#fffdf8"
        color="#171716"
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
