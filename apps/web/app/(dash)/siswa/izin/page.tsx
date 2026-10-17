"use client";

// Siswa: ajukan izin/sakit via kamera live (getUserMedia). Upload galeri TIDAK
// disediakan di UI; server menolak tanpa capture token valid (sekali pakai, 5 mnt).
// Foto: SATU jepretan foto bersama siswa + orang tua dalam satu frame.
import { useEffect, useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { useCamera } from "@/components/useCamera";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

function todayWibInput() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function IzinPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cam = useCamera("user");
  const videoRef = cam.videoRef;
  const streaming = cam.streaming;
  const [date, setDate] = useState(todayWibInput);
  const [kind, setKind] = useState("IZIN");
  const [desc, setDesc] = useState("");
  const [foto, setFoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useFetch<{ rows: { id: string; date: string; kind: string; status: string }[] }>("/api/leave");
  const consent = useFetch<{ consented: boolean; consentedAt?: string | null }>("/api/auth/consent");

  const consentKnown = Boolean(consent.data);
  const consented = consent.data?.consented === true;
  const needConsent = consentKnown && !consented;

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function startCamera() {
    const ok = await cam.start();
    if (!ok && cam.error) setMsg(cam.error.message);
    else if (ok) setMsg("Kamera menyala. Posisikan siswa dan orang tua dalam satu frame, lalu jepret.");
  }

  function stopCamera() {
    cam.stop();
  }

  function jepret() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) {
        setMsg("Gagal menjepret");
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      setFoto(b);
      setPreview(URL.createObjectURL(b));
      setMsg(`Foto bersama terjepret (${Math.round(b.size / 1024)}KB). Pastikan siswa dan orang tua terlihat dalam satu frame.`);
    }, "image/jpeg", 0.85);
  }

  function ulang() {
    if (preview) URL.revokeObjectURL(preview);
    setFoto(null);
    setPreview(null);
  }

  async function ajukan(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (needConsent) {
      setMsg("Persetujuan orang tua belum dicatat. Minta admin mencatat persetujuan dulu sebelum mengajukan.");
      return;
    }
    setBusy(true);
    setMsg(null);
    if (!foto) {
      setMsg("Jepret foto bersama dulu via kamera");
      setBusy(false);
      return;
    }
    try {
      // 1. Minta capture token server.
      const cap = await api("/api/leave/capture", { method: "POST" });
      const cd = await cap.json().catch(() => ({}));
      if (!cap.ok) {
        setMsg(cd.error || "Gagal minta token capture");
        consent.reload();
        return;
      }
      // 2. Kirim form + token + foto bersama sebagai studentPhoto.
      const form = new FormData();
      form.append("date", date);
      form.append("kind", kind);
      form.append("description", desc);
      form.append("captureToken", cd.token);
      form.append("studentPhoto", new File([foto], "bersama.jpg", { type: "image/jpeg" }));
      const res = await api("/api/leave", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
      else {
        setMsg("Pengajuan terkirim, menunggu persetujuan wali kelas");
        ulang();
        history.reload();
      }
    } catch {
      setMsg("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead kicker="Perizinan" title="Izin / sakit" desc="Foto bersama siswa dan orang tua diambil langsung dari kamera dalam satu frame (tidak bisa dari galeri). Pencegahan dasar, bukan anti-spoofing sempurna." />
      {consentKnown && !consented && (
        <Card className="mb-4">
          <Alert>Persetujuan orang tua belum dicatat. Minta admin/tata usaha mencatat persetujuan di menu Privasi, lalu muat ulang halaman ini sebelum mengajukan.</Alert>
        </Card>
      )}
      {consented && (
        <Card className="mb-4">
          <Alert>Persetujuan orang tua sudah tercatat. Anda bisa mengajukan izin.</Alert>
        </Card>
      )}
      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {!streaming
            ? <Button className="bg-ink text-cream" variant="sticker" type="button"  onClick={startCamera}>Nyalakan kamera</Button>
            : <Button variant="sticker-ghost" onClick={stopCamera}>Matikan kamera</Button>}
        </div>
        <video className="w-full max-w-[480px] bg-ink rounded-2xl" ref={videoRef} playsInline muted  />
        <canvas className="hidden" ref={canvasRef} />
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Button variant="sticker-ghost"            type="button"                        onClick={jepret}
            disabled={!streaming || needConsent || busy}
            title={needConsent ? "Menunggu persetujuan orang tua dicatat admin" : "Jepret foto bersama dalam satu frame"}
          >
            Jepret foto bersama
          </Button>
          {foto && <Button variant="sticker-ghost" onClick={ulang}>Ulangi</Button>}
          <span className="text-[13px] text-muted">{foto ? "Foto bersama: sudah ada" : "Foto bersama: belum ada"}</span>
        </div>
        {preview && (
          <img className="w-full max-w-[480px] rounded-2xl border border-solid border-line" src={preview} alt="Pratinjau foto bersama siswa dan orang tua" />
        )}
        <form className="grid gap-3 max-w-[520px] mt-3" onSubmit={ajukan}>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Tanggal:
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Jenis:
            <Select value={kind} onValueChange={(v) => setKind(v ?? "IZIN")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                <SelectItem value="IZIN">IZIN</SelectItem>
                <SelectItem value="SAKIT">SAKIT</SelectItem>
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Alasan (min 10 huruf):
            <textarea className="rounded-[14px] border border-solid border-line bg-cream pt-[9px] pr-[14px] pb-[9px] pl-[14px] text-sm" value={desc} onChange={(e) => setDesc(e.target.value)} required minLength={10} rows={3} />
          </label>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <Button variant="sticker"
              type="submit"
              disabled={busy || needConsent}
              title={needConsent ? "Menunggu persetujuan orang tua dicatat admin" : "Kirim pengajuan"}
            >
              {busy ? "Mengirim..." : "Ajukan"}
            </Button>
          </div>
          {needConsent && (
            <span className="text-[13px] text-muted">Tombol Ajukan aktif setelah admin mencatat persetujuan orang tua.</span>
          )}
        </form>
        {msg && <p className="font-bold">{msg}</p>}
      </Card>
      <Card>
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Riwayat saya</h2>
        {history.data && history.data.rows.length === 0 && <Alert>Belum pernah mengajukan.</Alert>}
        {history.data && history.data.rows.length > 0 && (
          <ul className="list-none m-0 p-0 grid gap-2">
            {history.data.rows.map((r) => (
              <li className="flex gap-[10px] items-center flex-wrap text-sm" key={r.id}>
                <span className="font-meta text-xs">{r.date.slice(0, 10)}</span>
                <Badge variant={statusVariant(r.kind)}>{r.kind}</Badge>
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
