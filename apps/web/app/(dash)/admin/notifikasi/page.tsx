"use client";

import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

interface KelasRow {
  id: string;
  name: string;
}

type PushTarget = "semua" | "guru" | "siswa" | "kelas";

const selectCls = "w-full min-h-[44px] rounded-[14px] border border-ink/25 bg-cream px-[14px] py-[10px] text-sm";

const labelCls = "grid gap-[6px] text-[13px] text-muted";

export default function NotifikasiAdminPage() {
  const { data: kelasData } = useFetch<{ rows: KelasRow[] }>("/api/classes?perPage=100");
  const daftarKelas = kelasData?.rows ?? [];

  // --- Panel Push ---
  const [target, setTarget] = useState<PushTarget>("semua");
  const [pushKelas, setPushKelas] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handlePush(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setPushMsg({ type: "err", text: "Judul dan isi pesan wajib diisi." });
      return;
    }
    if (target === "kelas" && !pushKelas) {
      setPushMsg({ type: "err", text: "Pilih kelas dulu." });
      return;
    }
    setPushBusy(true);
    setPushMsg(null);
    try {
      const res = await api("/api/push/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          ...(target === "kelas" ? { classId: pushKelas } : {}),
          title,
          body,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushMsg({ type: "err", text: d.error || "Gagal mengirim push." });
      } else {
        setPushMsg({ type: "ok", text: `Push terkirim ke ${d.sent} perangkat, gagal ${d.failed}.` });
        setTitle("");
        setBody("");
      }
    } catch {
      setPushMsg({ type: "err", text: "Koneksi bermasalah." });
    } finally {
      setPushBusy(false);
    }
  }

  // --- Panel WA ---
  const [waKelas, setWaKelas] = useState("");
  const [template, setTemplate] = useState("");
  const [waBusy, setWaBusy] = useState(false);
  const [waMsg, setWaMsg] = useState<{ type: "ok" | "err"; text: string; skipped?: { name: string; reason: string }[] } | null>(null);

  const preview = template.replaceAll("{nama}", "Budi");

  async function handleWa(e: React.FormEvent) {
    e.preventDefault();
    if (!waKelas) {
      setWaMsg({ type: "err", text: "Pilih kelas dulu." });
      return;
    }
    if (!template.trim()) {
      setWaMsg({ type: "err", text: "Template pesan wajib diisi." });
      return;
    }
    setWaBusy(true);
    setWaMsg(null);
    try {
      const res = await api("/api/wa/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ classId: waKelas, template }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWaMsg({ type: "err", text: d.error || "Gagal mengirim WA." });
      } else {
        setWaMsg({
          type: "ok",
          text: `WA diantrekan ke ${d.queued} nomor, dilewati ${d.skipped?.length ?? 0}.`,
          skipped: d.skipped ?? [],
        });
      }
    } catch {
      setWaMsg({ type: "err", text: "Koneksi bermasalah." });
    } finally {
      setWaBusy(false);
    }
  }

  return (
    <>
      <PageHead
        kicker="Pemberitahuan"
        title="Notifikasi"
        desc="Kirim push notification ke perangkat dan pesan WhatsApp massal ke orang tua."
      />

      {/* Panel 1: Push */}
      <Card className="max-w-[640px] mb-5">
        <h2 className="display text-[18px] mt-0 mr-0 mb-[14px] ml-0">Push Notification</h2>
        <form className="grid gap-[14px]" onSubmit={handlePush}>
          <label className={labelCls}>
            Target Penerima:
            <select value={target} onChange={(e) => setTarget(e.target.value as PushTarget)} className={selectCls}>
              <option value="semua">Semua (Guru & Siswa)</option>
              <option value="guru">Khusus Guru</option>
              <option value="siswa">Khusus Siswa</option>
              <option value="kelas">Per Kelas</option>
            </select>
          </label>

          {target === "kelas" && (
            <label className={labelCls}>
              Kelas:
              <select value={pushKelas} onChange={(e) => setPushKelas(e.target.value)} className={selectCls}>
                <option value="">— Pilih kelas —</option>
                {daftarKelas.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className={labelCls}>
            Judul:
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Pengumuman Ujian Tengah Semester"
              required
            />
          </label>

          <label className={labelCls}>
            Isi Pesan:
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Tuliskan detail pengumuman…"
              required
              className="w-full min-h-[110px] box-border resize-y rounded-[14px] border border-ink/25 bg-cream px-[14px] py-[10px] text-sm"
            />
          </label>

          <div className="grid">
            <Button className="justify-center w-full" variant="sticker" type="submit" disabled={pushBusy}>
              {pushBusy ? "Mengirim…" : "Kirim Push"}
            </Button>
          </div>
        </form>
        {pushMsg && (
          <div className="mt-4">
            <Alert>{pushMsg.text}</Alert>
          </div>
        )}
      </Card>

      {/* Panel 2: WA */}
      <Card className="max-w-[640px]">
        <h2 className="display text-[18px] mt-0 mr-0 mb-[14px] ml-0">WhatsApp Massal</h2>
        <form className="grid gap-[14px]" onSubmit={handleWa}>
          <label className={labelCls}>
            Kelas:
            <select value={waKelas} onChange={(e) => setWaKelas(e.target.value)} className={selectCls}>
              <option value="">— Pilih kelas —</option>
              {daftarKelas.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            Template Pesan (gunakan {"{nama}"} untuk nama siswa):
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              placeholder="Contoh: Yth. orang tua {nama}, besok ada ujian matematika. Mohon pastikan ananda belajar."
              required
              className="w-full min-h-[120px] box-border resize-y rounded-[14px] border border-ink/25 bg-cream px-[14px] py-[10px] text-sm"
            />
          </label>

          {template && (
            <div className="rounded-[14px] bg-sage pt-[10px] pr-[14px] pb-[10px] pl-[14px] text-[13px] whitespace-pre-wrap">
              <strong>Pratinjau:</strong>
              <div className="mt-1.5">{preview}</div>
            </div>
          )}

          <div className="grid">
            <Button className="justify-center w-full" variant="sticker" type="submit" disabled={waBusy}>
              {waBusy ? "Mengantrekan…" : "Kirim WA"}
            </Button>
          </div>
        </form>
        {waMsg && (
          <div className="mt-4 grid gap-2">
            <Alert>{waMsg.text}</Alert>
            {waMsg.skipped && waMsg.skipped.length > 0 && (
              <ul className="text-[13px] text-muted m-0 pl-5">
                {waMsg.skipped.slice(0, 20).map((s, i) => (
                  <li key={i}>{s.name} — {s.reason}</li>
                ))}
                {waMsg.skipped.length > 20 && <li>…dan {waMsg.skipped.length - 20} lainnya</li>}
              </ul>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
