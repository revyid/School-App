"use client";

// FASE 3 guru: SATU page gabungan Tugas|Asesmen + filter kelas.
// Data shared antar kelas (1 induk + N target): judul/instruksi sama,
// deadline tampil per-kelas bilafilter kelas aktif.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useFetch } from "@/app/lib/api";
import { Select, SelectTrigger, SelectValue, SelectPositioner, SelectPopup, SelectItem } from "@/components/ui/select";
import { PlusIcon } from "lucide-react";
import { TASK_TYPE_LABEL } from "@lacakedu/shared/lms";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

interface TaskRow {
  id: string;
  title: string;
  type: string;
  listStatus: string;
  deadline: string | null;
  class: { id: string; name: string };
  targets?: { classId: string; class: { id: string; name: string }; deadline: string | null }[];
  subject: { name: string } | null;
  _count: { submissions: number; categories: number };
}

interface AssessRow {
  id: string;
  title: string;
  deadline: string | null;
  class: { id: string; name: string } | null;
  targets?: { classId: string; class: { id: string; name: string }; deadline: string | null }[];
  subject?: { name: string } | null;
  _count?: { questions: number; attempts: number };
}

const STATUS_DOT: Record<string, string> = {
  Draf: "var(--color-muted)",
  Terjadwal: "var(--color-slate)",
  Aktif: "var(--color-olive-deep)",
  Selesai: "var(--color-terracotta-dark)",
};

function kelasLabel(t: TaskRow | AssessRow, filterClassId: string, fallback: string): string {
  if (!t.targets || t.targets.length === 0) {
    return ("class" in t && t.class ? (t.class as { name: string }).name : null) ?? fallback;
  }
  if (filterClassId) {
    const hit = t.targets.find((x) => x.classId === filterClassId);
    if (hit) return hit.class.name;
  }
  if (t.targets.length === 1) return t.targets[0].class.name;
  return `${t.targets.length} kelas`;
}

function Inner() {
  const sp = useSearchParams();
  const [jenis, setJenis] = useState<"tugas" | "asesmen">(sp.get("jenis") === "asesmen" ? "asesmen" : "tugas");
  const classes = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const [classId, setClassId] = useState("");
  const [statusF, setStatusF] = useState("semua");

  const kelasUnik = (classes.data?.rows ?? []).filter(
    (r, i, a) => a.findIndex((x) => x.class.id === r.class.id) === i,
  );
  const kelasNama = (id: string) => kelasUnik.find((r) => r.class.id === id)?.class.name ?? "";

  const params = new URLSearchParams({ status: statusF });
  if (classId) params.set("classId", classId);
  const tasks = useFetch<{ rows: TaskRow[] }>(jenis === "tugas" ? `/api/tasks?${params}` : null);
  const assessParams = classId ? `?classId=${encodeURIComponent(classId)}` : "";
  const assesses = useFetch<{ rows: AssessRow[] }>(jenis === "asesmen" ? `/api/assessments${assessParams}` : null);
  const assessRows = assesses.data?.rows ?? [];

  return (
    <>
      <PageHead kicker="Belajar" title="Tugas dan asesmen" desc="Satu daftar shared antar kelas: judul sama, deadline per kelas." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["tugas", "asesmen"] as const).map((j) => (
          <button
            key={j}
            type="button"
            onClick={() => setJenis(j)}
            className={`rounded-full px-4 py-2 text-[13px] font-bold ${jenis === j ? "bg-ink text-cream" : "border border-line text-muted-strong"}`}
          >
            {j === "tugas" ? "Tugas" : "Asesmen"}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-muted-strong">
            Kelas:
            <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
              <SelectTrigger><SelectValue placeholder="Semua kelas saya" /></SelectTrigger>
              <SelectPositioner><SelectPopup>
                {kelasUnik.map((r) => (
                  <SelectItem key={r.class.id} value={r.class.id}>{r.class.name}</SelectItem>
                ))}
              </SelectPopup></SelectPositioner>
            </Select>
          </label>
          {jenis === "tugas" && (
            <label className="flex items-center gap-2 text-[13px] text-muted-strong">
              Status:
              <Select value={statusF} onValueChange={(v) => setStatusF(v ?? "semua")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectPositioner><SelectPopup>
                  <SelectItem value="semua">Semua</SelectItem>
                  <SelectItem value="aktif">Aktif</SelectItem>
                  <SelectItem value="draf">Draf</SelectItem>
                </SelectPopup></SelectPositioner>
              </Select>
            </label>
          )}
        </div>
        <Link
          href={jenis === "tugas" ? "/guru/tugas/new" : "/guru/asesmen/new"}
          className="btn-sticker flex items-center gap-2 rounded-2xl border border-ink bg-ink px-4 py-2 text-[13px] font-bold text-cream no-underline hover:opacity-80"
        >
          <PlusIcon size={14} /> {jenis === "tugas" ? "Tambah tugas" : "Tambah asesmen"}
        </Link>
      </div>

      <Card>
        {jenis === "tugas" && (
          <>
            {tasks.loading && !tasks.data && (
              <div className="space-y-2 py-1">
                {[0,1,2,3,4].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <Skeleton className="size-2 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/5 rounded-lg" />
                      <Skeleton className="h-2.5 w-2/5 rounded-lg" />
                    </div>
                    <Skeleton className="h-3 w-10 rounded-lg" />
                  </div>
                ))}
              </div>
            )}
            {tasks.error && <Alert variant="destructive">Gagal: {tasks.error}</Alert>}
            {tasks.data && tasks.data.rows.length === 0 && (
              <Alert>Belum ada tugas{statusF !== "semua" ? " dengan filter ini" : ""}.</Alert>
            )}
            {tasks.data && tasks.data.rows.length > 0 && (
              <div className="flex flex-col gap-px">
                {tasks.data.rows.map((t) => (
                  <Link
                    key={t.id}
                    href={`/guru/tugas/${t.id}`}
                    className="group flex items-center gap-3 rounded-2xl px-3 py-3 no-underline transition-colors hover:bg-paper"
                  >
                    <span
                      className="mt-0.5 size-2 shrink-0 rounded-full"
                      // dynamic: warna status dari data tugas
                      style={{ background: STATUS_DOT[t.listStatus] ?? "var(--color-muted)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">{t.title}</span>
                      <span className="block text-[12px] text-muted-strong">
                        {kelasLabel(t, classId, kelasNama(classId))}
                        {t.subject ? ` · ${t.subject.name}` : ""}
                        {" · "}
                        {TASK_TYPE_LABEL[t.type] ?? t.type}
                        {" · "}
                        {t._count.submissions} terkumpul
                        {t._count.categories > 0 ? ` · ${t._count.categories} kategori` : ""}
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-[12px] font-bold"
                      // dynamic: warna status dari data tugas
                      style={{ color: STATUS_DOT[t.listStatus] ?? "var(--color-muted)" }}
                    >
                      {t.listStatus}
                    </span>
                    {t.deadline && (
                      <span className="shrink-0 text-[12px] text-muted-strong">
                        {new Date(t.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
        {jenis === "asesmen" && (
          <>
            {assesses.loading && !assesses.data && (
              <div className="space-y-2 py-1">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3">
                    <Skeleton className="size-2 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/5 rounded-lg" />
                      <Skeleton className="h-2.5 w-2/5 rounded-lg" />
                    </div>
                    <Skeleton className="h-3 w-10 rounded-lg" />
                  </div>
                ))}
              </div>
            )}
            {assesses.error && <Alert variant="destructive">Gagal: {assesses.error}</Alert>}
            {assesses.data && assessRows.length === 0 && (
              <Alert>Belum ada asesmen{classId ? " untuk kelas ini" : ""}.</Alert>
            )}
            {assesses.data && assessRows.length > 0 && (
              <div className="flex flex-col gap-px">
                {assessRows.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                    <span className="mt-0.5 size-2 shrink-0 rounded-full bg-olive-deep" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">{r.title}</span>
                      <span className="block text-[12px] text-muted-strong">
                        {kelasLabel(r, classId, kelasNama(classId))}
                        {r.subject ? ` · ${r.subject.name}` : ""}
                        {" · "}
                        {r._count?.questions ?? "?"} soal · {r._count?.attempts ?? "?"} mengerjakan
                      </span>
                    </span>
                    {r.deadline && (
                      <span className="shrink-0 text-[12px] text-muted-strong">
                        {new Date(r.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}

export default function GuruTugasPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
