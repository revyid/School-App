"use client";

// Admin: status WA + QR pairing + kuota + antrean.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Toolbar, Btn, Badge, WarmTable, warmCell, SegStat, Note, Err } from "@/components/DashUI";

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
    <>
      <PageHead kicker="Notifikasi" title="WhatsApp sekolah" desc="Pairing perangkat, pantau kuota, dan lihat antrean pesan keluar." />
      <Panel style={{ marginBottom: 16 }}>
        {st.loading && <Note>Memuat status…</Note>}
        {st.error && <Err>Gagal: {st.error}</Err>}
        {st.data && (
          <>
            <p style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Status: <Badge status={st.data.connected ? "AKTIF" : "ALPHA"}>{st.data.connected ? "Terhubung" : `Putus (${st.data.detail ?? "?"})`}</Badge>
            </p>
            {!st.data.connected && st.data.qr && (
              <div>
                <Note>Pindai QR ini dengan WA sekolah (Tautkan perangkat):</Note>
                {qrImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrImg} alt="QR pairing WA" width={256} height={256} style={{ borderRadius: 16, border: "1px solid rgba(23,23,22,.14)" }} />
                ) : (
                  <pre style={{ wordBreak: "break-all", whiteSpace: "pre-wrap", fontSize: 12 }}>{st.data.qr}</pre>
                )}
              </div>
            )}
            {!st.data.connected && !st.data.qr && <Note>QR belum tersedia — tunggu beberapa detik lalu muat ulang.</Note>}
            <Toolbar><Btn kind="ghost" type="button" onClick={() => st.reload()}>Muat ulang status</Btn></Toolbar>
          </>
        )}
      </Panel>
      {out.data && (
        <Panel>
          <h2 className="display" style={{ fontSize: 18, margin: "0 0 12px" }}>Kuota hari ini</h2>
          <SegStat stats={[
            { label: "Terkirim 24 jam", value: out.data.quota.sentDay },
            { label: "Batas harian", value: out.data.quota.dailyCap },
            { label: "Maks/menit", value: out.data.quota.perMinuteCap },
          ]} />
          <h2 className="display" style={{ fontSize: 18, margin: "16px 0 12px" }}>Antrean terakhir</h2>
          {out.data.rows.length === 0 && <Note>Antrean kosong.</Note>}
          {out.data.rows.length > 0 && (
            <WarmTable head={["Tujuan", "Isi", "Status", "Percobaan", "Error"]}>
              {out.data.rows.map((r) => (
                <tr key={r.id}>
                  <td style={warmCell({ whiteSpace: "nowrap" })}>{r.to}</td>
                  <td style={warmCell()}>{r.text}</td>
                  <td style={warmCell()}><Badge status={r.status.toUpperCase()}>{r.status}</Badge></td>
                  <td style={warmCell()}>{r.attempts}</td>
                  <td style={warmCell()}>{r.lastError ?? "-"}</td>
                </tr>
              ))}
            </WarmTable>
          )}
        </Panel>
      )}
    </>
  );
}
