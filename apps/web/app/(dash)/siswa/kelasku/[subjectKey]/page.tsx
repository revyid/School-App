"use client";

// Kelasku → halaman per mapel: header nama+guru, section Tugas dan Asesmen.
// subjectKey = subjectId atau `nama:<nama>` (key grup yang sama dipakai kelasku/page.tsx).
// Data dari /api/tasks?status=semua dan /api/assessments, filter client-side.
import { use, useMemo, type ReactNode } from "react";
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
      style={{
        flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999,
        background: bg, border: "1px solid rgba(23,23,22,.2)", whiteSpace: "nowrap",
      }}
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
      <Link href="/siswa/kelasku" style={{ fontSize: 13, fontWeight: 700, color: "#171716" }}>
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
      {galat && <Err>Gagal: {galat}</Err>}
      {!galat && (!memuat || tugas.data || asesmen.data) && (
        <>
          <h2 className="display" style={{ fontSize: 16, margin: "14px 0 8px" }}>
            Tugas ({view.daftarTugas.length})
          </h2>
          {view.daftarTugas.length === 0 ? (
            <Panel>
              <Note>Belum ada tugas mapel ini.</Note>
            </Panel>
          ) : (
            <Panel>
              <div style={{ display: "grid", gap: 10 }}>
                {view.daftarTugas.map((t) => (
                  <div key={t.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 14 }}>
                    <Badge
                      bg={t.state === "SUDAH" ? "#dcead0" : t.state === "TERLAMBAT" || t.state === "TUTUP" ? "#f6e8e3" : "#eeeadd"}
                    >
                      {labelTugas(t)}
                    </Badge>
                    <Link href={`/siswa/kelasku/tugas/${t.id}`} style={{ fontWeight: 600, color: "#171716" }}>
                      {t.title}
                    </Link>
                    {fmtTgl(t.deadline) && (
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#74746d", flexShrink: 0 }}>
                        {fmtTgl(t.deadline)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <h2 className="display" style={{ fontSize: 16, margin: "14px 0 8px" }}>
            Asesmen ({view.daftarAsesmen.length})
          </h2>
          {view.daftarAsesmen.length === 0 ? (
            <Panel>
              <Note>Belum ada asesmen mapel ini.</Note>
            </Panel>
          ) : (
            <Panel>
              <div style={{ display: "grid", gap: 10 }}>
                {view.daftarAsesmen.map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 14 }}>
                    <Badge bg={a.submitted ? "#dcead0" : "#eeeadd"}>{labelAsesmen(a)}</Badge>
                    <Link href={`/siswa/kelasku/asesmen/${a.id}`} style={{ fontWeight: 600, color: "#171716" }}>
                      {a.title}
                    </Link>
                    {fmtTgl(a.deadline) && (
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#74746d", flexShrink: 0 }}>
                        {fmtTgl(a.deadline)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
