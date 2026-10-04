import * as React from "react";
import { cn } from "./cn";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800",
        "disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px",
        size === "md" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-[13px]",
        variant === "primary" && "bg-green-800 text-white hover:bg-green-900",
        variant === "ghost" && "border border-stone-300 bg-transparent text-stone-700 hover:bg-stone-100",
        variant === "danger" && "border border-red-300 bg-transparent text-red-800 hover:bg-red-50",
        className,
      )}
      {...props}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm",
        "placeholder:text-stone-400 focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800",
      )}
      {...props}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-md border border-stone-300 bg-white px-2.5 py-2 text-sm",
        "focus:border-green-800 focus:outline-none focus:ring-1 focus:ring-green-800",
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-lg border border-stone-200 bg-white", className)} {...props} />;
}

export function PageTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-stone-500">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-10 text-center">
      <p className="text-sm text-stone-500">{text}</p>
      {action}
    </div>
  );
}

export function Err({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{text}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

// Tabel data: kolom dipilih dari keputusan user di halaman itu, bukan template generik.
export function Table<T>({
  cols,
  rows,
  keyOf,
  emptyText = "Belum ada data.",
}: {
  cols: { head: string; cell: (r: T) => React.ReactNode }[];
  rows: T[];
  keyOf: (r: T) => string;
  emptyText?: string;
}) {
  if (!rows.length) return <Empty text={emptyText} />;
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {cols.map((c) => (
              <th key={c.head} className="px-3 py-2 font-semibold text-stone-600">
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((r) => (
            <tr key={keyOf(r)} className="hover:bg-stone-50">
              {cols.map((c) => (
                <td key={c.head} className="px-3 py-2 align-top">
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Sebelumnya
      </Button>
      <span className="text-stone-500">
        {page}/{pages}
      </span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Berikutnya
      </Button>
    </div>
  );
}
