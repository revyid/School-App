"use client";

// Jadwal siswa: slot kelas sendiri per hari Senin–Sabtu + Minggu.
import { useMemo } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err } from "@/components/DashUI";
import { Skeleton } from "@/components/ui/skeleton";

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
      {error && <Err>Gagal: {error}</Err>}
      {!loading && !error && total === 0 && (
        <Panel>
          <Note>Belum ada jadwal.</Note>
        </Panel>
      )}
      <div style={{ display: "grid", gap: 12 }}>
        {ORDER.map((hari) => {
          const daftar = perHari.get(hari) ?? [];
          if (daftar.length === 0) return null;
          return (
            <Panel key={hari}>
              <h2 className="display" style={{ fontSize: 17, margin: "0 0 8px" }}>{HARI[hari] ?? `Hari ${hari}`}</h2>
              <div style={{ display: "grid", gap: 0 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "110px 1fr 1fr",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                    color: "#74746d",
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(23,23,22,.14)",
                  }}
                >
                  <span>Jam</span>
                  <span>Mapel</span>
                  <span>Guru</span>
                </div>
                {daftar.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "110px 1fr 1fr",
                      gap: 8,
                      fontSize: 13.5,
                      padding: "8px 0",
                      borderBottom: "1px solid rgba(23,23,22,.08)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)}
                    </span>
                    <span>{namaMapel(s)}</span>
                    <span style={{ color: "#74746d" }}>{s.teacher?.name ?? "-"}</span>
                  </div>
                ))}
              </div>
            </Panel>
          );
        })}
      </div>
    </>
  );
}
