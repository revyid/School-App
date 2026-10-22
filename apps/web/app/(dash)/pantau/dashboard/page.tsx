"use client";

// Dasbor root: agregat platform + grafik (absensi, izin, view, per sekolah,
// penggunaan fitur, antrean WA). Filter rentang waktu & sekolah, export CSV.
import { useMemo, useState } from "react";
import { useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import AnalyticsChart from "@/components/AnalyticsChart";

interface DayRow {
  date: string;
  value?: number;
  present?: number;
  pending?: number;
}

interface SchoolRow {
  id: string;
  name: string;
  slug: string;
  students: number;
  teachers: number;
  classes: number;
  attendance: number;
  present: number;
  tasks: number;
  submissions: number;
  leaves: number;
  books: number;
  views: number;
}

interface Analytics {
  range?: number;
  schoolId?: string | null;
  schools?: { id: string; name: string; slug: string }[];
  counts?: Record<string, number | undefined>;
  attendanceByDay?: DayRow[];
  leaveByDay?: DayRow[];
  viewsByDay?: DayRow[];
  newUsersByDay?: DayRow[];
  bySchool?: SchoolRow[];
  featureUsage?: { kind: string; label: string; value: number }[];
  wa?: { QUEUED: number; SENDING: number; SENT: number; FAILED: number };
}

const RANGES = [
  { v: 7, label: "7 hari" },
  { v: 30, label: "30 hari" },
  { v: 90, label: "90 hari" },
];

const fmt = (v: number | undefined) => (v == null ? "–" : v.toLocaleString("id-ID"));
const day = (d: string) => d.slice(5); // YYYY-MM-DD -> MM-DD

export default function PantauDashboardPage() {
  const [range, setRange] = useState(30);
  const [schoolId, setSchoolId] = useState("");
  const q = `/api/root/analytics?range=${range}${schoolId ? `&schoolId=${encodeURIComponent(schoolId)}` : ""}`;
  const analytics = useFetch<Analytics>(q);
  const t = analytics.data?.counts ?? {};
  const attendance = analytics.data?.attendanceByDay ?? [];
  const leaves = analytics.data?.leaveByDay ?? [];
  const views = analytics.data?.viewsByDay ?? [];
  const newUsers = analytics.data?.newUsersByDay ?? [];
  const bySchool = analytics.data?.bySchool ?? [];
  const featureUsage = analytics.data?.featureUsage ?? [];
  const wa = analytics.data?.wa ?? { QUEUED: 0, SENDING: 0, SENT: 0, FAILED: 0 };

  const labels = useMemo(() => attendance.map((r) => day(r.date)), [attendance]);
  const presentTotal = attendance.reduce((a, r) => a + (r.present ?? 0), 0);
  const recordTotal = attendance.reduce((a, r) => a + (r.value ?? 0), 0);
  const viewTotal = views.reduce((a, r) => a + (r.value ?? 0), 0);

  function exportCsv() {
    const head = ["sekolah", "siswa", "guru", "kelas", "absensi", "hadir", "tugas", "submission", "izin", "buku", "view"];
    const rows = bySchool.map((s) => [
      s.name, s.students, s.teachers, s.classes, s.attendance, s.present, s.tasks, s.submissions, s.leaves, s.books, s.views,
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lacakedu-analitik-${range}h-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHead
        kicker="Platform"
        title="Dasbor platform"
        desc="Absensi, izin, view, dan beban kerja seluruh sekolah dalam satu layar."
        right={
          <Button variant="sticker" type="button" onClick={exportCsv} disabled={bySchool.length === 0}>
            Export CSV
          </Button>
        }
      />

      {analytics.error && <Alert variant="destructive">{analytics.error}</Alert>}
      {analytics.loading && !analytics.data && <Alert>Memuat analitik…</Alert>}

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.v}
                type="button"
                variant={range === r.v ? "sticker" : "ghost"}
                onClick={() => setRange(r.v)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <div className="min-w-[220px] flex-1">
            <select
              id="filter-sekolah"
              name="filter-sekolah"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              aria-label="Filter sekolah"
              className="h-10 w-full rounded-xl border border-input bg-cream px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              <option value="">Semua sekolah</option>
              {(analytics.data?.schools ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <SegStat
        stats={[
          { label: "Pengguna", value: fmt(t.user), accent: "var(--color-mint)" },
          { label: "Siswa", value: fmt(t.student), accent: "var(--color-sun)" },
          { label: "Guru", value: fmt(t.teacher), accent: "var(--color-sky)" },
          { label: "Kelas", value: fmt(t.class), accent: "var(--color-mint)" },
          { label: "Absensi (periode)", value: fmt(t.attendance), accent: "var(--color-sage)" },
          { label: "Izin (periode)", value: fmt(t.leaveRequest), accent: "var(--color-sun)" },
          { label: "Izin menunggu", value: fmt(t.leavePending), accent: "var(--color-blush)" },
          { label: "Tugas", value: fmt(t.task), accent: "var(--color-sage)" },
          { label: "Submission", value: fmt(t.submission), accent: "var(--color-blush)" },
          { label: "Asesmen", value: fmt(t.assessment), accent: "var(--color-sky)" },
          { label: "Buku", value: fmt(t.book), accent: "var(--color-mint)" },
          { label: "View (periode)", value: fmt(viewTotal), accent: "var(--color-sun)" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="display m-0 text-[18px]">Kehadiran {range} hari</h2>
          <p className="mt-1 mb-0 font-meta text-[11px] text-muted">
            {recordTotal > 0
              ? `${presentTotal.toLocaleString("id-ID")} hadir dari ${recordTotal.toLocaleString("id-ID")} catatan`
              : "Belum ada data kehadiran."}
          </p>
          {attendance.length === 0 ? (
            <Alert>Belum ada data kehadiran.</Alert>
          ) : (
            <AnalyticsChart
              type="line"
              ariaLabel="Grafik kehadiran per hari"
              labels={labels}
              series={[
                { label: "Catatan absensi", data: attendance.map((r) => r.value ?? 0), color: "#e85e43" },
                { label: "Hadir", data: attendance.map((r) => r.present ?? 0), color: "#71845a" },
              ]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Izin siswa {range} hari</h2>
          {leaves.length === 0 ? (
            <Alert>Belum ada pengajuan izin.</Alert>
          ) : (
            <AnalyticsChart
              type="bar"
              ariaLabel="Grafik pengajuan izin per hari"
              labels={leaves.map((r) => day(r.date))}
              series={[{ label: "Izin", data: leaves.map((r) => r.value ?? 0) }]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">View konten {range} hari</h2>
          <p className="mt-1 mb-0 font-meta text-[11px] text-muted">Buku, materi, dan tugas yang dibuka (total per hari).</p>
          {views.length === 0 ? (
            <Alert>Belum ada data view.</Alert>
          ) : (
            <AnalyticsChart
              type="line"
              ariaLabel="Grafik view konten per hari"
              labels={views.map((r) => day(r.date))}
              series={[{ label: "View", data: views.map((r) => r.value ?? 0), color: "#6f9bb5" }]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Pengguna baru {range} hari</h2>
          {newUsers.length === 0 ? (
            <Alert>Belum ada pengguna baru.</Alert>
          ) : (
            <AnalyticsChart
              type="line"
              ariaLabel="Grafik pengguna baru per hari"
              labels={newUsers.map((r) => day(r.date))}
              series={[{ label: "Pengguna baru", data: newUsers.map((r) => r.value ?? 0), color: "#50643e" }]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Beban per sekolah</h2>
          <p className="mt-1 mb-0 font-meta text-[11px] text-muted">Absensi, tugas, dan submission per sekolah.</p>
          {bySchool.length === 0 ? (
            <Alert>Belum ada data sekolah.</Alert>
          ) : (
            <AnalyticsChart
              type="bar"
              horizontal
              ariaLabel="Grafik absensi per sekolah"
              labels={bySchool.map((s) => s.name)}
              series={[
                { label: "Absensi", data: bySchool.map((s) => s.attendance), color: "#e85e43" },
                { label: "Tugas", data: bySchool.map((s) => s.tasks), color: "#71845a" },
                { label: "Submission", data: bySchool.map((s) => s.submissions), color: "#6f9bb5" },
              ]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Penggunaan fitur</h2>
          {featureUsage.length === 0 ? (
            <Alert>Belum ada data.</Alert>
          ) : (
            <AnalyticsChart
              type="doughnut"
              ariaLabel="Grafik penggunaan fitur"
              labels={featureUsage.map((f) => f.label)}
              series={[{ label: "Jumlah", data: featureUsage.map((f) => f.value) }]}
            />
          )}
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Antrean WhatsApp</h2>
          <p className="mt-1 mb-0 font-meta text-[11px] text-muted">
            Menunggu {wa.QUEUED} · diproses {wa.SENDING} · terkirim {wa.SENT} · gagal {wa.FAILED}
          </p>
          <AnalyticsChart
            type="bar"
            ariaLabel="Grafik antrean WhatsApp per status"
            labels={["Menunggu", "Diproses", "Terkirim", "Gagal"]}
            series={[{ label: "Pesan", data: [wa.QUEUED, wa.SENDING, wa.SENT, wa.FAILED] }]}
          />
        </Card>

        <Card>
          <h2 className="display m-0 text-[18px]">Ringkasan per sekolah</h2>
          <p className="mt-1 mb-0 font-meta text-[11px] text-muted">Klik Export CSV di kanan atas untuk mengunduh tabel ini.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-meta text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th className="py-2 pr-3">Sekolah</th>
                  <th className="py-2 pr-3">Siswa</th>
                  <th className="py-2 pr-3">Guru</th>
                  <th className="py-2 pr-3">Absensi</th>
                  <th className="py-2 pr-3">Hadir</th>
                  <th className="py-2 pr-3">Tugas</th>
                  <th className="py-2 pr-3">Izin</th>
                  <th className="py-2 pr-3">Buku</th>
                  <th className="py-2 pr-3">View</th>
                </tr>
              </thead>
              <tbody>
                {bySchool.map((s) => (
                  <tr key={s.id} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-3">{s.name}</td>
                    <td className="py-2 pr-3">{fmt(s.students)}</td>
                    <td className="py-2 pr-3">{fmt(s.teachers)}</td>
                    <td className="py-2 pr-3">{fmt(s.attendance)}</td>
                    <td className="py-2 pr-3">{fmt(s.present)}</td>
                    <td className="py-2 pr-3">{fmt(s.tasks)}</td>
                    <td className="py-2 pr-3">{fmt(s.leaves)}</td>
                    <td className="py-2 pr-3">{fmt(s.books)}</td>
                    <td className="py-2 pr-3">{fmt(s.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
