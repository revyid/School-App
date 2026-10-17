"use client";

// Kelasku: kartu per mapel — nama, guru, jadwal mingguan, badge lingkaran
// tugas+asesmen belum, klik untuk membuka daftar.
import { useMemo } from "react";
import Link from "next/link";
import { useFetch } from "@/app/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

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
  type: string;
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

export default function KelaskuPage() {
  const profil = useFetch<{ user: { studentProfile: { class: { id: string; name: string } | null } | null } }>(
    "/api/profile",
  );
  const classId = profil.data?.user.studentProfile?.class?.id ?? null;
  const jadwal = useFetch<{ rows: Slot[] }>(classId ? `/api/timetable?classId=${classId}` : null);
  const tugas = useFetch<{ rows: Tugas[] }>("/api/tasks?status=semua");
  const asesmen = useFetch<{ rows: Asesmen[] }>("/api/assessments");

  const mapels = useMemo(() => {
    const slots = jadwal.data?.rows ?? [];
    const tasks = tugas.data?.rows ?? [];
    const ass = asesmen.data?.rows ?? [];
    const grup = new Map<string, { nama: string; guru: Set<string>; slot: Slot[]; tugas: Tugas[]; asesmen: Asesmen[] }>();
    for (const s of slots) {
      const key = s.subjectId ?? `nama:${namaMapel(s)}`;
      let g = grup.get(key);
      if (!g) {
        g = { nama: namaMapel(s), guru: new Set(), slot: [], tugas: [], asesmen: [] };
        grup.set(key, g);
      }
      if (s.teacher?.name) g.guru.add(s.teacher.name);
      g.slot.push(s);
    }
    const kunciTugas = (nama: string | null) => `nama:${nama ?? "Tanpa mapel"}`;
    for (const t of tasks) {
      const k = kunciTugas(t.subjectName);
      let g = grup.get(k);
      if (!g) {
        g = { nama: t.subjectName ?? "Tanpa mapel", guru: new Set(), slot: [], tugas: [], asesmen: [] };
        grup.set(k, g);
      }
      g.tugas.push(t);
    }
    for (const a of ass) {
      const k = a.subjectId ?? kunciTugas(a.subjectName);
      let g = grup.get(k);
      if (!g) {
        g = { nama: a.subjectName ?? "Tanpa mapel", guru: new Set(), slot: [], tugas: [], asesmen: [] };
        grup.set(k, g);
      }
      g.asesmen.push(a);
    }
    return [...grup.entries()].map(([key, g]) => {
      const belum =
        g.tugas.filter((t) => t.state === "BELUM" || t.state === "TERLAMBAT").length +
        g.asesmen.filter((a) => !a.submitted).length;
      const slotUrut = [...g.slot].sort((x, y) => x.dayOfWeek - y.dayOfWeek || x.startTime.localeCompare(y.startTime));
      return {
        key,
        nama: g.nama,
        guru: [...g.guru].join(", ") || "-",
        slot: slotUrut,
        tugas: g.tugas,
        asesmen: g.asesmen,
        belum,
      };
    }).sort((a, b) => b.belum - a.belum || a.nama.localeCompare(b.nama, "id"));
  }, [jadwal.data, tugas.data, asesmen.data]);

  const memuat = profil.loading || jadwal.loading || tugas.loading || asesmen.loading;
  const galat = profil.error ?? jadwal.error ?? tugas.error ?? asesmen.error;

  return (
    <>
      <PageHead
        kicker="Belajar"
        title="Kelasku"
        desc={profil.data?.user.studentProfile?.class ? `Kelas ${profil.data.user.studentProfile.class.name}` : "Jadwal, tugas, dan asesmen per mata pelajaran."}
      />
      {memuat && !profil.data && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {galat && <Alert variant="destructive">Gagal: {galat}</Alert>}
      {!memuat && !galat && mapels.length === 0 && (
        <Card>
          <Alert>Belum ada jadwal — hubungi admin.</Alert>
        </Card>
      )}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,_minmax(280px,_1fr))]">
        {mapels.map((m) => {
          return (
            <Link
              key={m.key}
              href={`/siswa/kelasku/${encodeURIComponent(m.key)}`}
              className="card card-lift p-[18px] flex items-start gap-3 no-underline"
             
            >
              <span className="flex-1 min-w-[0px]">
                <span className="display text-[19px] block">{m.nama}</span>
                <span className="text-[13px] text-muted block mt-[2px]">
                  {m.guru}
                </span>
                <span className="text-[12.5px] text-muted block mt-1.5">
                  {m.slot.length === 0
                    ? "Jadwal belum diatur"
                    : m.slot.map((s) => `${HARI[s.dayOfWeek] ?? "?"} ${s.startTime}–${s.endTime}`).join(" · ")}
                </span>
              </span>
              <span
                aria-label={m.belum > 0 ? `${m.belum} belum dikerjakan` : "Semua beres"}
                title={m.belum > 0 ? `${m.belum} belum dikerjakan` : "Semua beres"}
                className={cn(
                  "inline-flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink text-[15px] font-extrabold text-cream",
                  m.belum > 0 ? "bg-terracotta-deep" : "bg-olive-deep",
                )}
              >
                {m.belum}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
