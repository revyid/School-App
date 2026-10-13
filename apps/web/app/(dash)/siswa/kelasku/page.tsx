"use client";

// Kelasku: kartu per mapel — nama, guru, jadwal mingguan, badge lingkaran
// tugas+asesmen belum, klik untuk membuka daftar.
import { useMemo } from "react";
import Link from "next/link";
import { useFetch } from "@/app/lib/api";
import { PageHead, Panel, Note, Err } from "@/components/DashUI";
import { Skeleton } from "@/components/ui/skeleton";

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
      {galat && <Err>Gagal: {galat}</Err>}
      {!memuat && !galat && mapels.length === 0 && (
        <Panel>
          <Note>Belum ada jadwal — hubungi admin.</Note>
        </Panel>
      )}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {mapels.map((m) => {
          return (
            <Link
              key={m.key}
              href={`/siswa/kelasku/${encodeURIComponent(m.key)}`}
              className="card card-lift"
              style={{ padding: 18, display: "flex", alignItems: "flex-start", gap: 12, textDecoration: "none", color: "inherit" }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="display" style={{ fontSize: 19, display: "block" }}>{m.nama}</span>
                <span style={{ fontSize: 13, color: "#74746d", display: "block", marginTop: 2 }}>
                  {m.guru}
                </span>
                <span style={{ fontSize: 12.5, color: "#74746d", display: "block", marginTop: 6 }}>
                  {m.slot.length === 0
                    ? "Jadwal belum diatur"
                    : m.slot.map((s) => `${HARI[s.dayOfWeek] ?? "?"} ${s.startTime}–${s.endTime}`).join(" · ")}
                </span>
              </span>
              <span
                aria-label={m.belum > 0 ? `${m.belum} belum dikerjakan` : "Semua beres"}
                title={m.belum > 0 ? `${m.belum} belum dikerjakan` : "Semua beres"}
                style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 15, color: "#fffdf8",
                  background: m.belum > 0 ? "#e85e43" : "#50643e",
                  border: "2px solid #171716",
                }}
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
