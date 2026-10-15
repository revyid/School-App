"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import UploadPopup from "@/components/UploadPopup";

export interface SoalPayload {
  stem: string;
  type: string;
  options: string[];
  correctIndex: string;
  image: File | null;
  video: File | null;
}

export default function SoalSheet({
  open,
  onOpenChange,
  busy,
  msg,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy?: boolean;
  msg?: string | null;
  onSubmit: (p: SoalPayload) => void | Promise<void>;
}) {
  const [stem, setStem] = useState("");
  const [type, setType] = useState("MCQ");
  const [opts, setOpts] = useState("a \nb \nc ");
  const [correct, setCorrect] = useState("0");
  const [img, setImg] = useState<File | null>(null);
  const [vid, setVid] = useState<File | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const options = opts.split("\n").map((s) => s.replace(/^[a-hA-H\d][.)\-:]?\s+/, "").trim()).filter(Boolean);
    await onSubmit({ stem, type, options, correctIndex: correct, image: img, video: vid });
    setStem(""); setOpts("a \nb \nc "); setImg(null); setVid(null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Tambah soal ke bank</SheetTitle>
          <SheetDescription>Isi batang soal, opsi jawaban, dan kunci. Lampiran gambar/video opsional.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <form onSubmit={(e) => void submit(e)} className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold text-muted-strong uppercase tracking-wide">Tipe</span>
              <Select value={type} onValueChange={(v) => setType(v ?? "MCQ")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  <SelectItem value="MCQ">Pilihan ganda</SelectItem>
                  <SelectItem value="SORTING">Mengurutkan</SelectItem>
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="soal-stem">Batang soal</Label>
              <textarea id="soal-stem" value={stem} onChange={(e) => setStem(e.target.value)} required rows={3}
                className="rounded-2xl border border-line bg-cream px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="soal-opts">Opsi (satu per baris)</Label>
              <textarea id="soal-opts" value={opts} onChange={(e) => setOpts(e.target.value)} required rows={4}
                className="rounded-2xl border border-line bg-cream px-3 py-2 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ink/30" />
            </div>
            {type === "MCQ" && (
              <div className="grid gap-1.5">
                <Label htmlFor="soal-kunci">Kunci (index, 0 = opsi pertama)</Label>
                <Input id="soal-kunci" value={correct} onChange={(e) => setCorrect(e.target.value)} inputMode="numeric" />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Gambar soal (JPG/PNG, maks 5MB, opsional)</Label>
              <UploadPopup accept="image/jpeg,image/png,image/webp" maxMb={5} onFile={(f) => setImg(f)} label={img?.name} />
            </div>
            <div className="grid gap-1.5">
              <Label>Video soal (MP4/WebM, maks 20MB, opsional)</Label>
              <UploadPopup accept="video/mp4,video/webm" maxMb={20} onFile={(f) => setVid(f)} label={vid?.name} />
            </div>
            {msg && <p className="text-[12px] font-bold text-olive-deep">{msg}</p>}
            <Button type="submit" disabled={busy}>Simpan ke bank</Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
