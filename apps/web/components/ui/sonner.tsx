"use client";

// Toaster ringan buatan sendiri (menggantikan Sonner eksternal demi satu
// sistem UI yang sama, lihat D12). API: useToast().toast({title, description}).
// Sesuai N3/D11: judul maks 2 baris, isi maks 3 baris, rata kiri, wrap di mana pun.
import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  variant?: "default" | "success" | "danger";
}

const ToastContext = React.createContext<{ toast: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <Toaster />");
  return ctx;
}

interface ToastItem extends ToastOptions { id: number }

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const toast = React.useCallback((o: ToastOptions) => {
    const id = ++seq.current;
    // Antre bila banyak notifikasi berdekatan (N3): maks 3 tampil, sisanya menunggu.
    setItems((prev) => [...prev, { ...o, id }].slice(-6));
  }, []);

  React.useEffect(() => {
    if (!items.length) return;
    const timers = items.map((i) => setTimeout(() => remove(i.id), i.duration ?? 5000));
    return () => timers.forEach(clearTimeout);
  }, [items, remove]);

  const api = React.useMemo(() => ({ toast }), [toast]);

  const visible = items.slice(0, 3);
  const hidden = items.length - visible.length;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" role="region" aria-label="Notifikasi" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        {visible.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-xl",
              item.variant === "success" ? "border-olive/40 bg-cream" : item.variant === "danger" ? "border-destructive/40 bg-cream" : "border-line bg-cream",
            )}
          >
            <div className="min-w-0 flex-1 text-left">
              <p className="line-clamp-2 text-sm font-bold text-ink">{item.title}</p>
              {item.description ? <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground" style={{ overflowWrap: "anywhere" }}>{item.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="shrink-0 cursor-pointer rounded-full p-1 text-muted-strong transition-colors hover:bg-paper-deep"
              aria-label="Tutup notifikasi"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ))}
        {hidden > 0 && (
          <p className="rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-cream">+{hidden} lainnya</p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
