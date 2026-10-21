"use client";

// Dialog "Pesan baru" (halaman /anonim): daftar guru tanpa login + pilihan
// penerima (multi-select) lalu kirim form ke /api/anonim.
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PesanBaruDialog({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [gurus, setGurus] = useState<{ id: string; name: string; email: string | null; subjects: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  // Clamp lebar dialog di viewport.
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    const clamp = () => {
      const max = Math.min(el.scrollWidth, window.innerWidth - 24);
      el.style.maxWidth = `${max}px`;
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open]);

  // Publik: /api/gurus membaca slug dari Host, jadi pengunjung tanpa login tetap
  // dapat daftar guru sekolah ini.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchGurus = async () => {
      try {
        const res = await fetch("/api/gurus");
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data?.teachers) setGurus(data.teachers);
        }
      } catch {
        // fallback kosong: daftar guru tetap kosong, dialog tidak menghalangi form utama.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchGurus();
    return () => { cancelled = true; };
  }, [open]);

  return (
    <>
      <Button type="button" variant="sticker" onClick={() => setOpen(true)}>
        {title}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={contentRef} className="max-w-md" style={{ maxWidth: "calc(100vw - 24px)" }}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {loading && <p className="py-2 text-sm text-muted">Memuat guru…</p>}
            {!loading && gurus.length === 0 && <p className="py-2 text-sm text-muted">Belum ada guru di sekolah ini.</p>}
            {!loading && (
              <>
                <p className="text-[12px] font-bold uppercase tracking-wide text-muted-strong">Pilih penerima</p>
                {selected.length > 0 && (
                  <p className="text-[12px] text-muted">
                    {selected.length} terpilih: {selected.map((id) => gurus.find((g) => g.id === id)?.name ?? id).join(", ")}
                  </p>
                )}
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-line bg-paper/50 p-2">
                  {gurus.map((g) => {
                    const checked = selected.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          setSelected(
                            checked ? selected.filter((x) => x !== g.id) : [...selected, g.id],
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-paper",
                          checked && "bg-cream",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-md border-2",
                            checked ? "border-ink bg-ink" : "border-input",
                          )}
                        >
                          {checked && <CheckIcon size={10} strokeWidth={3} className="text-cream" />}
                        </span>
                        <span className="flex-1 font-medium">{g.name}</span>
                        {g.subjects.length > 0 && <span className="text-[11px] text-muted-strong">{g.subjects.join(", ")}</span>}
                        {g.email && <span className="text-[11px] text-muted-strong">{g.email}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
