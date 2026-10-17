'use client';

// Form CTA anonim publik — tanpa login (masyarakat umum).
// Basis: shadcn/Base UI (Input, Textarea, Button) + token edukids.
import { useState } from "react";
import SwipeToast from "./SwipeToast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function AnonimForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const res = await fetch("/api/anonim", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, message }),
    }).catch(() => null);

    const d = (await res?.json().catch(() => ({}))) as { success?: boolean; error?: string; message?: string };

    if (res?.ok && d.success) {
      setToast({ title: "Terkirim", body: d.message ?? "Pesan anonim Anda sudah diteruskan ke sekolah." });
      setSubject("");
      setMessage("");
    } else {
      setToast({ title: "Gagal terkirim", body: d.error ?? `Gagal (${res?.status ?? "jaringan"})` });
    }
    setLoading(false);
  }

  return (
    <>
      <form
        onSubmit={kirim}
        className="grid gap-3.5 rounded-[20px] border border-line bg-paper px-[22px] py-6"
      >
        <label className="grid gap-1.5 text-[13px] text-muted">
          Subjek:
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="mis. Usulan kantin sehat"
            required
            maxLength={120}
          />
        </label>
        <label className="grid gap-1.5 text-[13px] text-muted">
          Isi pesan:
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tulis aspirasi, laporan, atau saran Anda…"
            required
            rows={5}
            maxLength={2000}
            className="resize-y"
          />
        </label>
        <Button variant="sticker" type="submit" disabled={loading} className="h-11 w-full justify-center text-sm">
          {loading ? "Mengirim…" : "Kirim Anonim"}
        </Button>
      </form>

      {/* Toast notifikasi status kirim (tema terang) */}
      <SwipeToast
        open={!!toast}
        onClose={() => setToast(null)}
        title={toast?.title ?? ""}
        description={toast?.body ?? ""}
        background="var(--color-cream)"
        color="var(--color-ink)"
        fuseColor="var(--color-terracotta)"
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
