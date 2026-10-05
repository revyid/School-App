import * as React from "react";
import { cn } from "./cn";
import { PageHead, Panel, WarmTable, warmCell, TextInput, TextSelect, Btn, Toolbar, Note, Err as DashErr } from "./DashUI";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

// Kompat: gaya diselaraskan ke DashUI (stiker edukids), API tetap sama.
export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const kind = variant === "danger" ? "dark" : variant === "ghost" ? "ghost" : "primary";
  return (
    <Btn
      kind={kind as "primary" | "ghost" | "dark"}
      {...props}
      className={cn(size === "sm" && "text-[13px]", className)}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <TextSelect {...props} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium" style={{ color: "#74746d" }}>{label}</span>
      {children}
    </label>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <Panel>
      <div className={cn(className)} {...props} />
    </Panel>
  );
}

export function PageTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return <PageHead kicker="Halaman" title={title} desc={desc} right={right} />;
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
    <WarmTable head={cols.map((c) => c.head)}>
      {rows.map((r) => (
        <tr key={keyOf(r)}>
          {cols.map((c) => (
            <td key={c.head} style={warmCell()}>{c.cell(r)}</td>
          ))}
        </tr>
      ))}
    </WarmTable>
  );
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <Toolbar>
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Sebelumnya
      </Button>
      <span style={{ color: "#74746d", fontSize: 13 }}>{page}/{pages}</span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Berikutnya
      </Button>
    </Toolbar>
  );
}

export function ErrNote({ children }: { children: React.ReactNode }) {
  return <DashErr>{children}</DashErr>;
}
