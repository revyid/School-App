"use client";

// Jadwal siswa: slot kelas sendiri per hari Senin–Sabtu + Minggu.
import { useMemo } from "react";
import { useFetch } from "@/app/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

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

function namaMapel(s: Slot): string {
  return s.subjectRef?.name || s.subjectName || "Tanpa mapel";
}

export default function SiswaJadwalPage() {
  const { data, loading, error } = useFetch<{ rows: Slot[] }>("/api/timetable");

  const perHari = useMemo(() => {
    const grup = new Map<number, Slot[]>();
    for (const s of data?.rows ?? []) {
      const daftar = grup.get(s.dayOfWeek) ?? [];
      daftar.push(s);
      grup.set(s.dayOfWeek, daftar);
    }
    for (const daftar of grup.values()) {
      daftar.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grup;
  }, [data]);

  const total = data?.rows.length ?? 0;

  return (
    <>
      <PageHead
        kicker="Belajar"
        title="Jadwal"
        desc={
          data?.rows[0]?.class?.name
            ? `Jadwal pelajaran kelas ${data.rows[0].class.name}.`
            : "Jadwal pelajaran mingguan kelasmu."
        }
      />
      {loading && !data && (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {error && <Alert variant="destructive">Gagal: {error}</Alert>}
      {!loading && !error && total === 0 && (
        <Card>
          <Alert>Belum ada jadwal.</Alert>
        </Card>
      )}
      <div className="grid gap-3">
        {ORDER.map((hari) => {
          const daftar = perHari.get(hari) ?? [];
          if (daftar.length === 0) return null;
          return (
            <Card key={hari}>
              <h2 className="display text-[17px] mt-0 mr-0 mb-2 ml-0">{HARI[hari] ?? `Hari ${hari}`}</h2>
              <div className="grid gap-[0px]">
                <div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-xs font-extrabold uppercase tracking-[.04em] text-muted pt-1.5 pr-0 pb-1.5 pl-0 border-b border-line"
                  
                >
                  <span>Jam</span>
                  <span>Mapel</span>
                  <span>Guru</span>
                </div>
                {daftar.map((s) => (
                  <div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-[13.5px] pt-2 pr-0 pb-2 pl-0 border-b border-line"
                    key={s.id}
                    
                  >
                    <span className="font-semibold">
                      {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                    </span>
                    <span>{namaMapel(s)}</span>
                    <span className="text-muted">{s.teacher?.name ?? "-"}</span>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
