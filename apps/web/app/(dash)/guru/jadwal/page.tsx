"use client";

import { useMemo } from "react";
import { useFetch } from "@/app/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface SlotRow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string | null;
  subjectRef: { id: string; name: string } | null;
  teacher: { id: string; name: string } | null;
  class: { id: string; name: string };
}

export default function GuruJadwalPage() {
  const { data, loading, error } = useFetch<{ rows: SlotRow[] }>("/api/timetable?teacherId=me");

  const grouped = useMemo(() => {
    const rows = data?.rows ?? [];
    // Urutkan hari 1..6 lalu 0 (Senin - Sabtu, lalu Minggu bila ada)
    const order = [1, 2, 3, 4, 5, 6, 0];
    const map = new Map<number, SlotRow[]>();
    for (const r of rows) {
      const list = map.get(r.dayOfWeek) ?? [];
      list.push(r);
      map.set(r.dayOfWeek, list);
    }
    return order
      .filter((d) => (map.get(d) ?? []).length > 0)
      .map((d) => ({
        day: d,
        dayName: DAYS[d] ?? `Hari ${d}`,
        slots: (map.get(d) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [data]);

  return (
    <>
      <PageHead
        kicker="Guru"
        title="Jadwal mengajar"
        desc="Jadwal mengajar mingguan Anda sesuai data pelajaran di sekolah."
      />

      {loading && !data && (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {error && <Alert variant="destructive">Gagal memuat jadwal: {error}</Alert>}

      {!loading && !error && grouped.length === 0 && (
        <Card>
          <Alert>Belum ada jadwal mengajar yang terdaftar untuk akun Anda. Hubungi administrator sekolah.</Alert>
        </Card>
      )}

      <div className="grid gap-5">
        {grouped.map(({ day, dayName, slots }) => (
          <section key={day} className="card p-5 rounded-2xl">
            <h2 className="display text-lg font-bold text-ink mb-3">{dayName}</h2>
            <div className="divide-y divide-line">
              {slots.map((s) => {
                const mapel = s.subjectRef?.name || s.subjectName || "Tanpa mata pelajaran";
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block rounded-lg px-2.5 py-1 text-[12px] font-mono font-bold bg-paper-deep border border-solid border-line"
                       
                      >
                        {s.startTime} – {s.endTime}
                      </span>
                      <div>
                        <span className="block font-bold text-[14.5px] text-ink">{mapel}</span>
                        <span className="block text-[12px] text-muted-strong">Kelas {s.class.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
