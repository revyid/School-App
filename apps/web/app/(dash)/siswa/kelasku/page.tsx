"use client";

// Kelasku: kartu per mapel — nama, guru, jadwal mingguan, badge lingkaran
// tugas+asesmen belum, klik untuk membuka daftar.
import { useMemo, useState } from "react";
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
  // Sorot tugas dari redirect URL lama (/siswa/tugas/[id] → ?tugas=).
  // Baca window.location langsung (tanpa useSearchParams agar tak perlu Suspense).
  const [sorotTugas] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tugas"),
  );
  const profil = useFetch<{ user: { studentProfile: { class: { id: string; name: string } | null } | null } }>(
    "/api/profile",
  );
  const classId = profil.data?.user.studentProfile?.class?.id ?? null;
  const jadwal = useFetch<{ rows: Slot[] }>(classId ? `/api/timetable?classId=${classId}` : null);
  const tugas = useFetch<{ rows: Tugas[] }>("/api/tasks?status=semua");
  const asesmen = useFetch<{ rows: Asesmen[] }>("/api/assessments");
  const [buka, setBuka] = useState<string | null>(null);

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
          const terbuka = buka === m.key;
          return (
            <article key={m.key} className="card card-lift" style={{ padding: 18 }}>
              <button
                type="button"
                onClick={() => setBuka(terbuka ? null : m.key)}
                aria-expanded={terbuka}
                style={{
                  all: "unset", cursor: "pointer", display: "flex", width: "100%",
                  alignItems: "flex-start", gap: 12, boxSizing: "border-box",
                }}
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
              </button>
              {terbuka && (
                <div style={{ marginTop: 12, borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 12, display: "grid", gap: 8 }}>
                  {m.tugas.length === 0 && m.asesmen.length === 0 && (
                    <p style={{ fontSize: 13, color: "#74746d", margin: 0 }}>Tidak ada tugas atau asesmen mapel ini.</p>
                  )}
                  {m.tugas.map((t) => (
                    <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13.5 }}>
                      <span
                        style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                          background: t.state === "SUDAH" ? "#dcead0" : t.state === "TERLAMBAT" || t.state === "TUTUP" ? "#f6e8e3" : "#eeeadd",
                          border: "1px solid rgba(23,23,22,.2)",
                        }}
                      >
                        Tugas
                      </span>
                      <Link
                        href={`/siswa/kelasku/tugas/${t.id}`}
                        style={{
                          fontWeight: sorotTugas === t.id ? 800 : 600, color: "#171716",
                          background: sorotTugas === t.id ? "#f5c94a" : "transparent",
                          borderRadius: 6, padding: "0 4px",
                        }}
                      >
                        {t.title}
                      </Link>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#74746d", flexShrink: 0 }}>
                        {t.state === "SUDAH" ? (t.score != null ? `Nilai ${t.score}` : "Sudah") : t.state === "TERLAMBAT" ? "Terlambat" : t.state === "TUTUP" ? "Tutup" : "Belum"}
                        {t.deadline ? ` · ${new Date(t.deadline).toLocaleDateString("id-ID")}` : ""}
                      </span>
                    </div>
                  ))}
                  {m.asesmen.map((a) => (
                    <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13.5 }}>
                      <span
                        style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
                          background: a.submitted ? "#dcead0" : "#eeeadd",
                          border: "1px solid rgba(23,23,22,.2)",
                        }}
                      >
                        Asesmen
                      </span>
                      <Link href={`/siswa/kelasku/asesmen/${a.id}`} style={{ fontWeight: 600, color: "#171716" }}>
                        {a.title}
                      </Link>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#74746d", flexShrink: 0 }}>
                        {a.submitted ? (a.score != null ? `Skor ${a.score}` : "Sudah") : "Belum"}
                        {a.deadline ? ` · ${new Date(a.deadline).toLocaleDateString("id-ID")}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
