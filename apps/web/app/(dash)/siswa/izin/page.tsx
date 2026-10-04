"use client";

// Siswa: ajukan izin/sakit via kamera live (getUserMedia). Upload galeri TIDAK
// disediakan di UI; server menolak tanpa capture token valid (sekali pakai, 5 mnt).
import { useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";

export default function IzinPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [date, setDate] = useState("");
  const [kind, setKind] = useState("IZIN");
  const [desc, setDesc] = useState("");
  const [fotoSiswa, setFotoSiswa] = useState<Blob | null>(null);
  const [fotoOrtu, setFotoOrtu] = useState<Blob | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const history = useFetch<{ rows: { id: string; date: string; kind: string; status: string }[] }>("/api/leave");

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setMsg("Kamera tidak tersedia (butuh HTTPS/kamera HP)");
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    const stream = v?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setStreaming(false);
  }

  function jepret(target: "siswa" | "ortu") {
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
      if (target === "siswa") setFotoSiswa(b);
      else setFotoOrtu(b);
      setMsg(`Foto ${target === "siswa" ? "siswa" : "orang tua"} terjepret (${Math.round(b.size / 1024)}KB)`);
    }, "image/jpeg", 0.85);
  }

  async function ajukan(e: React.FormEvent) {
    e.preventDefault();
    if (!fotoSiswa) {
      setMsg("Jepret foto siswa dulu via kamera");
      return;
    }
    // 1. Minta capture token server.
    const cap = await api("/api/leave/capture", { method: "POST" });
    const cd = await cap.json().catch(() => ({}));
    if (!cap.ok) {
      setMsg(cd.error || "Gagal minta token capture");
      return;
    }
    // 2. Kirim form + token + foto.
    const form = new FormData();
    form.append("date", date);
    form.append("kind", kind);
    form.append("description", desc);
    form.append("captureToken", cd.token);
    form.append("studentPhoto", new File([fotoSiswa], "siswa.jpg", { type: "image/jpeg" }));
    if (fotoOrtu) form.append("parentPhoto", new File([fotoOrtu], "ortu.jpg", { type: "image/jpeg" }));
    const res = await api("/api/leave", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Pengajuan terkirim, menunggu persetujuan wali kelas");
      setFotoSiswa(null);
      setFotoOrtu(null);
      history.reload();
    }
  }

  return (
    <main>
      <h1>Izin / Sakit</h1>
      <p>Foto wajib diambil langsung dari kamera (tidak bisa dari galeri). Pencegahan dasar, bukan anti-spoofing sempurna.</p>
      <div>
        {!streaming
          ? <button type="button" onClick={startCamera}>Nyalakan kamera</button>
          : <button type="button" onClick={stopCamera}>Matikan kamera</button>}
      </div>
      <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 480, background: "#000" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div>
        <button type="button" onClick={() => jepret("siswa")} disabled={!streaming}>Jepret foto saya</button>
        <button type="button" onClick={() => jepret("ortu")} disabled={!streaming}>Jepret foto orang tua</button>
        <span> {fotoSiswa ? "✓ siswa" : "· siswa"} {fotoOrtu ? "✓ ortu" : "· ortu (opsional)"}</span>
      </div>
      <form onSubmit={ajukan}>
        <label>Tanggal: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        <label>Jenis:
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="IZIN">IZIN</option>
            <option value="SAKIT">SAKIT</option>
          </select>
        </label>
        <label>Alasan (min 10 huruf): <textarea value={desc} onChange={(e) => setDesc(e.target.value)} required minLength={10} /></label>
        <button type="submit">Ajukan</button>
      </form>
      {msg && <p>{msg}</p>}
      <h2>Riwayat saya</h2>
      {history.data && (
        <ul>
          {history.data.rows.map((r) => (
            <li key={r.id}>{r.date.slice(0, 10)} · {r.kind} · {r.status}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
