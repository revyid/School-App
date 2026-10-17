"use client";

// Admin: status WA + QR pairing + kuota + kirim manual + antrean.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, useFetch } from "@/app/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WaAdminPage() {
  const st = useFetch<{ connected: boolean; detail?: string; qr?: string | null }>("/api/wa/status");
  const out = useFetch<{
    rows: { id: string; to: string; text: string; status: string; attempts: number; lastError: string | null; createdAt: string }[];
    quota: { sentDay: number; dailyCap: number; perMinuteCap: number };
  }>("/api/wa/outbox");
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  async function sendManual(e: React.FormEvent) {
    e.preventDefault();
    setSendMsg("Mengirim…");
    try {
      const res = await api("/api/wa/outbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendMsg("Gagal: " + (d.error || res.status));
        return;
      }
      setSendMsg("Masuk antrean — pantau status di tabel bawah.");
      setTo("");
      setText("");
      out.reload();
    } catch {
      setSendMsg("Gagal mengirim (offline?).");
    }
  }

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
      <Card className="mb-4">
        {st.loading && <Alert>Memuat status…</Alert>}
        {st.error && <Alert variant="destructive">Gagal: {st.error}</Alert>}
        {st.data && (
          <>
            <p className="flex gap-2 items-center">
              Status: <Badge variant={statusVariant(st.data.connected ? "AKTIF" : "ALPHA")}>{st.data.connected ? "Terhubung" : `Putus (${st.data.detail ?? "?"})`}</Badge>
            </p>
            {!st.data.connected && st.data.qr && (
              <div>
                <Alert>Pindai QR ini dengan WA sekolah (Tautkan perangkat):</Alert>
                {qrImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rounded-2xl border border-solid border-line" src={qrImg} alt="QR pairing WA" width={256} height={256} />
                ) : (
                  <pre className="break-all whitespace-pre-wrap text-xs">{st.data.qr}</pre>
                )}
              </div>
            )}
            {!st.data.connected && !st.data.qr && <Alert>QR belum tersedia — tunggu beberapa detik lalu muat ulang.</Alert>}
            <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker-ghost" type="button" onClick={() => st.reload()}>Muat ulang status</Button></div>
          </>
        )}
      </Card>
      <Card className="mb-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Kirim manual</h2>
          <form className="grid gap-[10px] max-w-[520px]" onSubmit={sendManual}>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Nomor tujuan (08…/62…):
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="08…" required />
            </label>
            <label className="grid gap-[6px] text-[13px] text-muted">
              Isi pesan:
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis pesan…" required />
            </label>
            <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" type="submit">Masukkan antrean</Button></div>
            {sendMsg && <Alert>{sendMsg}</Alert>}
          </form>
      </Card>
      {out.data && (
        <Card>
          <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Kuota hari ini</h2>
          <SegStat stats={[
            { label: "Terkirim 24 jam", value: out.data.quota.sentDay },
            { label: "Batas harian", value: out.data.quota.dailyCap },
            { label: "Maks/menit", value: out.data.quota.perMinuteCap },
          ]} />
          <h2 className="display text-[18px] mt-4 mr-0 mb-3 ml-0">Antrean terakhir</h2>
          {out.data.rows.length === 0 && <Alert>Antrean kosong.</Alert>}
          {out.data.rows.length > 0 && (
                        <div className="warm-table overflow-x-auto rounded-2xl border border-line">
              <Table className="text-[13.5px] min-w-[560px]">
                <TableHeader>
                  <TableRow className="border-line bg-paper-deep hover:bg-paper-deep">
                    <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Tujuan"}</TableHead>
                    <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Isi"}</TableHead>
                    <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Status"}</TableHead>
                    <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Percobaan"}</TableHead>
                    <TableHead className="whitespace-nowrap text-[10px] tracking-[.09em]">{"Error"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
              {out.data.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.to}</TableCell>
                  <TableCell>{r.text}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status.toUpperCase())}>{r.status}</Badge></TableCell>
                  <TableCell>{r.attempts}</TableCell>
                  <TableCell>{r.lastError ?? "-"}</TableCell>
                </TableRow>
              ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
