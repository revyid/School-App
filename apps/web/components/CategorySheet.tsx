"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Trash2Icon } from "lucide-react";
import { UPLOAD_ACCEPT_LABEL } from "@sms/shared/lms";

export interface CatItem {
  id?: string;
  name: string;
  instruction?: string | null;
  required: boolean;
  accept: string[];
}

export default function CategorySheet({
  open,
  onOpenChange,
  cats,
  loading,
  busy,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cats: CatItem[];
  loading?: boolean;
  busy: boolean;
  onAdd: (c: { name: string; instruction: string; required: boolean; accept: string[] }) => void | Promise<void>;
  onRemove: (indexOrId: number | string) => void;
}) {
  const [name, setName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [accept, setAccept] = useState<string[]>(["PDF"]);
  const [required, setRequired] = useState(false);

  function toggle(ft: string) {
    setAccept((p) => {
      const n = p.includes(ft) ? p.filter((x) => x !== ft) : [...p, ft];
      return n.length ? n : p;
    });
  }

  async function submit() {
    if (!name.trim()) return;
    await onAdd({ name: name.trim(), instruction, required, accept });
    setName(""); setInstruction(""); setAccept(["PDF"]); setRequired(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Kategori unggahan</SheetTitle>
          <SheetDescription>Tentukan jenis file yang boleh dikumpulkan per kategori.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          <section className="rounded-2xl border border-line bg-paper/60 p-4">
            <h3 className="mb-3 text-sm font-extrabold">Tambah kategori</h3>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <Label htmlFor="cat-name">Nama kategori</Label>
                <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Laporan, Presentasi, Video…" maxLength={120} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="cat-instr">Instruksi kategori (opsional)</Label>
                <Input id="cat-instr" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Catatan khusus…" maxLength={10000} />
              </div>
              <div>
                <span className="mb-1.5 block text-[12px] font-bold text-muted-strong uppercase tracking-wide">Tipe file diterima</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(UPLOAD_ACCEPT_LABEL) as string[]).map((acc) => (
                    <label key={acc} className="flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-bold transition-colors"
                      style={accept.includes(acc) ? { background: "#50643e", color: "#fff", borderColor: "#50643e" } : { background: "#fffdf8", color: "#575752", borderColor: "rgba(23,23,22,.2)" }}>
                      <input type="checkbox" className="sr-only" checked={accept.includes(acc)} onChange={() => toggle(acc)} />
                      {UPLOAD_ACCEPT_LABEL[acc as keyof typeof UPLOAD_ACCEPT_LABEL]}
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="size-4" />
                Wajib dikumpulkan
              </label>
              <Button onClick={() => void submit()} disabled={busy || !name.trim()}>Tambah kategori</Button>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-extrabold">Daftar kategori ({cats.length})</h3>
            {loading && !cats.length && (<div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>)}
            {!loading && cats.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kategori.</p>}
            {cats.map((c, i) => (
              <div key={c.id ?? i} className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-cream p-3 text-sm">
                <span className="truncate"><strong>{c.name}</strong> {c.required ? "(wajib)" : "(opsional)"} · {c.accept.join(", ")}</span>
                <Button variant="ghost" size="icon-xs" aria-label={`Hapus kategori ${c.name}`} disabled={busy} onClick={() => onRemove(c.id ?? i)}>
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
