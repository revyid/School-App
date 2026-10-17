"use client";

// Kelasku → halaman per mapel: header nama+guru, section Tugas dan Asesmen.
// subjectKey = subjectId atau `nama:<nama>` (key grup yang sama dipakai kelasku/page.tsx).
// Data dari /api/tasks?status=semua dan /api/assessments, filter client-side.
import { use, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useFetch } from "@/app/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface Slot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectName: string | null;
  subjectRef: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
  class: { id: string; name: string };
}

interface Tugas {
  id: string;
  title: string;
  deadline: string | null;
  subjectName: string | null;
  state: string;
  score: number | null;
}

interface Asesmen {
  id: string;
  title: string;
  deadline: string | null;
  subjectId: string | null;
  subjectName: string | null;
  submitted: boolean;
  score: number | null;
}

function namaMapel(s: Slot): string {
  return s.subjectRef?.name || s.subjectName || "Tanpa mapel";
}

function kunciSlot(s: Slot): string {
  return s.subjectId ?? `nama:${namaMapel(s)}`;
}

function labelTugas(t: Tugas): string {
  if (t.state === "SUDAH") return t.score != null ? `Nilai ${t.score}` : "Sudah";
  if (t.state === "TERLAMBAT") return "Terlambat";
  if (t.state === "TUTUP") return "Tutup";
  return "Belum";
}

function labelAsesmen(a: Asesmen): string {
  if (a.submitted) return a.score != null ? `Skor ${a.score}` : "Sudah";
  return "Belum";
}

function fmtTgl(d: string | null): string {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString("id-ID");
}

function Badge({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span
      // dynamic: warna badge dari state tugas
      style={{ background: bg }}
      className="shrink-0 whitespace-nowrap rounded-full border border-ink/20 px-2 py-[2px] text-[11px] font-extrabold"
    >
      {children}
    </span>
  );
}

export default function KelaskuMapelPage({ params }: { params: Promise<{ subjectKey: string }> }) {
  const { subjectKey } = use(params);
  let key = subjectKey;
  try {
    key = decodeURIComponent(subjectKey);
  } catch {
    key = subjectKey;
  }
  const isNama = key.startsWith("nama:");

  const profil = useFetch<{ user: { studentProfile: { class: { id: string; name: string } | null } | null } }>(
    "/api/profile",
  );
  const classId = profil.data?.user.studentProfile?.class?.id ?? null;
  const jadwal = useFetch<{ rows: Slot[] }>(classId ? `/api/timetable?classId=${classId}` : null);
  const tugas = useFetch<{ rows: Tugas[] }>("/api/tasks?status=semua");
  const asesmen = useFetch<{ rows: Asesmen[] }>("/api/assessments");

  const view = useMemo(() => {
    const slot = (jadwal.data?.rows ?? []).filter((s) => kunciSlot(s) === key);
    const semuaAsesmen = asesmen.data?.rows ?? [];
    const semuaTugas = tugas.data?.rows ?? [];
    // Nama kanonis: dari slot dulu, lalu asesmen (untuk key id tanpa slot), lalu key nama.
    const nama =
      slot.length > 0
        ? namaMapel(slot[0])
        : (semuaAsesmen.find((a) => !isNama && a.subjectId === key)?.subjectName ??
          (isNama ? key.slice("nama:".length) : "Mata pelajaran"));
    const guruSet = new Set<string>();
    for (const s of slot) if (s.teacher?.name) guruSet.add(s.teacher.name);
    const namaKey = `nama:${nama}`;
    // Tugas (API siswa tak bawa subjectId) cocok via nama; asesmen via subjectId atau nama.
    const daftarTugas = semuaTugas.filter((t) => `nama:${t.subjectName ?? "Tanpa mapel"}` === namaKey);
    const daftarAsesmen = semuaAsesmen.filter(
      (a) => a.subjectId === key || `nama:${a.subjectName ?? "Tanpa mapel"}` === namaKey,
    );
    const slotUrut = [...slot].sort((x, y) => x.dayOfWeek - y.dayOfWeek || x.startTime.localeCompare(y.startTime));
    return {
      nama,
      guru: [...guruSet].join(", ") || "-",
      jadwalStr: slotUrut.map((s) => `${HARI[s.dayOfWeek] ?? "?"} ${s.startTime}–${s.endTime}`).join(" · "),
      daftarTugas,
      daftarAsesmen,
    };
  }, [jadwal.data, tugas.data, asesmen.data, key, isNama]);

  const memuat = profil.loading || jadwal.loading || tugas.loading || asesmen.loading;
  const galat = profil.error ?? jadwal.error ?? tugas.error ?? asesmen.error;

  return (
    <>
      <Link className="text-[13px] font-bold text-ink" href="/siswa/kelasku">
        ← Kelasku
      </Link>
      <PageHead
        kicker="Kelasku"
        title={view.nama}
        desc={view.jadwalStr ? `${view.guru} · ${view.jadwalStr}` : view.guru}
      />
      {memuat && !tugas.data && !asesmen.data && (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {galat && <Alert variant="destructive">Gagal: {galat}</Alert>}
      {!galat && (!memuat || tugas.data || asesmen.data) && (
        <>
          <h2 className="display text-base mt-[14px] mr-0 mb-2 ml-0">
            Tugas ({view.daftarTugas.length})
          </h2>
          {view.daftarTugas.length === 0 ? (
            <Card>
              <Alert>Belum ada tugas mapel ini.</Alert>
            </Card>
          ) : (
            <Card>
              <div className="grid gap-[10px]">
                {view.daftarTugas.map((t) => (
                  <div className="flex gap-2 items-baseline text-sm" key={t.id}>
                    <Badge
                      bg={t.state === "SUDAH" ? "var(--color-mint-soft)" : t.state === "TERLAMBAT" || t.state === "TUTUP" ? "var(--color-blush)" : "var(--color-paper-deep)"}
                    >
                      {labelTugas(t)}
                    </Badge>
                    <Link className="font-semibold text-ink" href={`/siswa/kelasku/tugas/${t.id}`}>
                      {t.title}
                    </Link>
                    {fmtTgl(t.deadline) && (
                      <span className="ml-auto text-xs text-muted shrink-0">
                        {fmtTgl(t.deadline)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <h2 className="display text-base mt-[14px] mr-0 mb-2 ml-0">
            Asesmen ({view.daftarAsesmen.length})
          </h2>
          {view.daftarAsesmen.length === 0 ? (
            <Card>
              <Alert>Belum ada asesmen mapel ini.</Alert>
            </Card>
          ) : (
            <Card>
              <div className="grid gap-[10px]">
                {view.daftarAsesmen.map((a) => (
                  <div className="flex gap-2 items-baseline text-sm" key={a.id}>
                    <Badge bg={a.submitted ? "var(--color-mint-soft)" : "var(--color-paper-deep)"}>{labelAsesmen(a)}</Badge>
                    <Link className="font-semibold text-ink" href={`/siswa/kelasku/asesmen/${a.id}`}>
                      {a.title}
                    </Link>
                    {fmtTgl(a.deadline) && (
                      <span className="ml-auto text-xs text-muted shrink-0">
                        {fmtTgl(a.deadline)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
