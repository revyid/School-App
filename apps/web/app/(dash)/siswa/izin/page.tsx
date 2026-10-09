"use client";

// Siswa: ajukan izin/sakit via kamera live (getUserMedia). Upload galeri TIDAK
// disediakan di UI; server menolak tanpa capture token valid (sekali pakai, 5 mnt).
import { useRef, useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, TextInput, TextSelect, Btn, Badge, Note } from "@/components/DashUI";

function todayWibInput() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function IzinPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [date, setDate] = useState(todayWibInput);
  const [kind, setKind] = useState("IZIN");
  const [desc, setDesc] = useState("");
  const [fotoSiswa, setFotoSiswa] = useState<Blob | null>(null);
  const [fotoOrtu, setFotoOrtu] = useState<Blob | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
    if (busy) return;
    setBusy(true);
    setMsg(null);
    if (!fotoSiswa) {
      setMsg("Jepret foto siswa dulu via kamera");
      setBusy(false);
      return;
    }
    try {
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
    } catch {
      setMsg("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead kicker="Perizinan" title="Izin / sakit" desc="Foto wajib diambil langsung dari kamera (tidak bisa dari galeri). Pencegahan dasar, bukan anti-spoofing sempurna." />
      <Panel style={{ marginBottom: 16 }}>
        <Toolbar>
          {!streaming
            ? <Btn type="button" kind="dark" onClick={startCamera}>Nyalakan kamera</Btn>
            : <Btn type="button" kind="ghost" onClick={stopCamera}>Matikan kamera</Btn>}
        </Toolbar>
        <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 480, background: "#171716", borderRadius: 16 }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <Toolbar>
          <Btn type="button" kind="ghost" onClick={() => jepret("siswa")} disabled={!streaming}>Jepret foto saya</Btn>
          <Btn type="button" kind="ghost" onClick={() => jepret("ortu")} disabled={!streaming}>Jepret foto orang tua</Btn>
          <span style={{ fontSize: 13, color: "#74746d" }}>{fotoSiswa ? "✓ siswa" : "· siswa"} {fotoOrtu ? "✓ ortu" : "· ortu (opsional)"}</span>
        </Toolbar>
        <form onSubmit={ajukan} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Tanggal:
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Jenis:
            <TextSelect value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="IZIN">IZIN</option>
              <option value="SAKIT">SAKIT</option>
            </TextSelect>
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#74746d" }}>
            Alasan (min 10 huruf):
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} required minLength={10} rows={3} style={{ borderRadius: 14, border: "1px solid rgba(23,23,22,.25)", background: "#fffdf8", padding: "9px 14px", fontSize: 14 }} />
          </label>
          <Toolbar><Btn type="submit" disabled={busy}>{busy ? "Mengirim…" : "Ajukan"}</Btn></Toolbar>
        </form>
        {msg && <p style={{ fontWeight: 700 }}>{msg}</p>}
      </Panel>
      <Panel>
        <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Riwayat saya</h2>
        {history.data && history.data.rows.length === 0 && <Note>Belum pernah mengajukan.</Note>}
        {history.data && history.data.rows.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {history.data.rows.map((r) => (
              <li key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
                <span style={{ fontFamily: "var(--font-meta)", fontSize: 12 }}>{r.date.slice(0, 10)}</span>
                <Badge status={r.kind} />
                <Badge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
