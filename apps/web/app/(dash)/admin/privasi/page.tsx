"use client";

// Admin: flag persetujuan ortu + teks kebijakan privasi.
import { useState } from "react";
import { api, useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export default function PrivasiAdminPage() {
  const [studentId, setStudentId] = useState("");
  const students = useFetch<{ rows: { user: { id: string; name: string; nisn: string | null }; class: { name: string } | null }[] }>("/api/students?perPage=100");
  const consent = useFetch<{ consent: { studentId: string; consented: boolean } }>(
    studentId ? `/api/consent?studentId=${studentId}` : null,
  );
  const policy = useFetch<{ policy: { text: string } | null }>("/api/policy");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function tandai(consented: boolean) {
    const res = await api("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId, consented }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg(consented ? "Ditandai disetujui" : "Ditandai belum disetujui");
      consent.reload();
    }
  }

  async function simpanPolicy(e: React.FormEvent) {
    e.preventDefault();
    const res = await api("/api/policy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(d.error || `Gagal (${res.status})`);
    else {
      setMsg("Kebijakan tersimpan");
      policy.reload();
    }
  }

  return (
    <>
      <PageHead kicker="Kepatuhan" title="Privasi dan persetujuan ortu" desc="Catat persetujuan orang tua dan kelola teks kebijakan privasi sekolah." />
      <Card className="mb-4">
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Flag persetujuan</h2>
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <Select value={studentId} onValueChange={(v) => setStudentId(v ?? "")}>
            <SelectTrigger><SelectValue placeholder="— pilih siswa —" /></SelectTrigger>
            <SelectPositioner><SelectPopup>
              {(students.data?.rows ?? []).map((r) => (
                <SelectItem key={r.user.id} value={r.user.id}>
                  {r.user.name}{r.user.nisn ? ` (${r.user.nisn})` : ""}{r.class ? ` — ${r.class.name}` : ""}
                </SelectItem>
              ))}
            </SelectPopup></SelectPositioner>
          </Select>
        </div>
        {consent.data && (
          <p className="flex gap-2 items-center flex-wrap">
            Status: <Badge variant={statusVariant(consent.data.consent.consented ? "AKTIF" : "PENDING")}>{consent.data.consent.consented ? "Disetujui" : "Belum"}</Badge>
            <Button variant="sticker" type="button" onClick={() => tandai(true)}>Tandai setuju</Button>
            <Button variant="sticker-ghost" type="button" onClick={() => tandai(false)}>Tandai belum</Button>
          </p>
        )}
      </Card>
      <Card>
        <h2 className="display text-[18px] mt-0 mr-0 mb-3 ml-0">Kebijakan privasi sekolah</h2>
        {policy.data?.policy && <Alert>Saat ini: {policy.data.policy.text.slice(0, 200)}…</Alert>}
        <form className="grid gap-3 max-w-[560px]" onSubmit={simpanPolicy}>
          <label className="grid gap-[6px] text-[13px] text-muted">
            Teks kebijakan:
            <textarea className="rounded-[14px] border border-solid border-line bg-cream pt-[9px] pr-[14px] pb-[9px] pl-[14px] text-sm" value={text} onChange={(e) => setText(e.target.value)} rows={6} />
          </label>
          <div className="mb-4 flex flex-wrap items-center gap-2.5"><Button variant="sticker" type="submit">Simpan</Button></div>
        </form>
        {msg && <p className="font-bold">{msg}</p>}
      </Card>
    </>
  );
}
