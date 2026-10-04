"use client";

// Admin: status WA + QR pairing + kuota + antrean.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useFetch } from "@/app/lib/api";

export default function WaAdminPage() {
  const st = useFetch<{ connected: boolean; detail?: string; qr?: string | null }>("/api/wa/status");
  const out = useFetch<{
    rows: { id: string; to: string; text: string; status: string; attempts: number; lastError: string | null; createdAt: string }[];
    quota: { sentDay: number; dailyCap: number; perMinuteCap: number };
  }>("/api/wa/outbox");
  const [qrImg, setQrImg] = useState<string | null>(null);

  useEffect(() => {
    const s = st.data?.qr;
    if (!s) {
      setQrImg(null);
      return;
    }
    QRCode.toDataURL(s, { width: 256, margin: 1 }).then(setQrImg).catch(() => setQrImg(null));
  }, [st.data?.qr]);

  return (
    <main>
      <h1>WhatsApp Sekolah</h1>
      {st.loading && <p>Memuat status…</p>}
      {st.error && <p>Gagal: {st.error}</p>}
      {st.data && (
        <div>
          <p>Status: {st.data.connected ? "Terhubung" : `Putus (${st.data.detail ?? "?"})`}</p>
          {!st.data.connected && st.data.qr && (
            <div>
              <p>Pindai QR ini dengan WA sekolah (Tautkan perangkat):</p>
              {qrImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImg} alt="QR pairing WA" width={256} height={256} />
              ) : (
                <pre style={{ wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{st.data.qr}</pre>
              )}
            </div>
          )}
          {!st.data.connected && !st.data.qr && <p>QR belum tersedia — tunggu beberapa detik lalu muat ulang.</p>}
          <button type="button" onClick={() => st.reload()}>Muat ulang status</button>
        </div>
      )}
      {out.data && (
        <div>
          <h2>Kuota hari ini</h2>
          <p>Terkirim 24 jam terakhir: {out.data.quota.sentDay}/{out.data.quota.dailyCap} (maks/menit: {out.data.quota.perMinuteCap})</p>
          <h2>Antrean terakhir</h2>
          <table>
            <thead><tr><th>Tujuan</th><th>Isi</th><th>Status</th><th>Percobaan</th><th>Error</th></tr></thead>
            <tbody>
              {out.data.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.to}</td>
                  <td>{r.text}</td>
                  <td>{r.status}</td>
                  <td>{r.attempts}</td>
                  <td>{r.lastError ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
