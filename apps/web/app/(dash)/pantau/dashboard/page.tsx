"use client";

// Dasbor root: agregat platform + tren kehadiran 30 hari.
import { useFetch } from "@/app/lib/api";
import { PageHead } from "@/components/ui/page-header";
import { SegStat } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

interface DayRow {
  date: string;
  value?: number;
  present?: number;
}

interface Analytics {
  period?: string;
  counts?: Totals;
  attendanceByDay?: DayRow[];
  newUsersByDay?: DayRow[];
}

interface Totals {
  user?: number;
  student?: number;
  teacher?: number;
  class?: number;
  submission?: number;
  task?: number;
  attendance?: number;
  leaveRequest?: number;
  announcement?: number;
}

interface School {
  id: string;
  slug: string;
  name: string;
}

interface SchoolsResponse {
  schools?: School[];
  total?: number;
}

const fmt = (v: number | undefined) => (v == null ? "–" : v.toLocaleString("id-ID"));

// Line chart CSS/SVG tanpa library; nilai 0..max dipetakan ke tinggi tetap.
function LineChart({ rows, label, unit = "puncak" }: { rows: DayRow[]; label: string; unit?: string }) {
  const values = rows.map((r) => r.value ?? 0);
  const max = Math.max(1, ...values);
  const w = 720;
  const h = 180;
  const pad = 10;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const xy = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${pad + (values.length - 1) * step},${h - pad}`;

  return (
    <div>
      <svg
        role="img"
        aria-label={`Grafik ${label} ${values.length} hari terakhir`}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 180, display: "block" }}
      >
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        <polygon points={area} fill="var(--color-terracotta)" opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-terracotta-deep)"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between font-meta text-[10px] text-muted">
        <span>{rows[0]?.date?.slice(0, 10) ?? "–"}</span>
        <span>
          {unit} {max.toLocaleString("id-ID")}
        </span>
        <span>{rows[rows.length - 1]?.date?.slice(0, 10) ?? "–"}</span>
      </div>
    </div>
  );
}

export default function PantauDashboardPage() {
  const analytics = useFetch<Analytics>("/api/root/analytics");
  const schools = useFetch<SchoolsResponse>("/api/root/schools");
  const t = analytics.data?.counts ?? {};
  const attendanceByDay = analytics.data?.attendanceByDay ?? [];
  const newUsersByDay = analytics.data?.newUsersByDay ?? [];
  const schoolCount = t.class ?? schools.data?.total ?? schools.data?.schools?.length;
  const presentTotal = attendanceByDay.reduce((a, r) => a + (r.present ?? 0), 0);
  const recordTotal = attendanceByDay.reduce((a, r) => a + (r.value ?? 0), 0);

  return (
    <>
      <PageHead
        kicker="Platform"
        title="Dasbor platform"
        desc="Ringkasan seluruh sekolah, pengguna, dan aktivitas belajar di satu tempat."
      />

      {analytics.error && <Alert variant="destructive">{analytics.error}</Alert>}
      {analytics.loading && !analytics.data && <Alert>Memuat analitik…</Alert>}

      <SegStat
        stats={[
          { label: "Total pengguna", value: fmt(t.user), accent: "var(--color-mint)" },
          { label: "Siswa", value: fmt(t.student), accent: "var(--color-sun)" },
          { label: "Guru", value: fmt(t.teacher), accent: "var(--color-sky)" },
          { label: "Kelas", value: fmt(t.class), accent: "var(--color-mint)" },
          { label: "Submission", value: fmt(t.submission), accent: "var(--color-blush)" },
          { label: "Tugas", value: fmt(t.task), accent: "var(--color-sage)" },
          { label: "Sekolah", value: fmt(schoolCount), accent: "var(--color-terracotta)" },
          { label: "Absensi (total)", value: fmt(t.attendance), accent: "var(--color-sage)" },
          { label: "Izin (total)", value: fmt(t.leaveRequest), accent: "var(--color-sun)" },
          { label: "Pengumuman", value: fmt(t.announcement), accent: "var(--color-blush)" },
        ]}
      />

      <Card>
        <h2 className="display m-0 text-[18px]">Kehadiran 30 hari</h2>
        <p className="mt-1 mb-0 font-meta text-[11px] text-muted">
          {recordTotal > 0
            ? `${presentTotal.toLocaleString("id-ID")} hadir dari ${recordTotal.toLocaleString("id-ID")} catatan absensi`
            : "Belum ada data kehadiran."}
        </p>
        {attendanceByDay.length === 0 ? (
          <Alert>Belum ada data kehadiran.</Alert>
        ) : (
          <LineChart rows={attendanceByDay} label="kehadiran" unit="puncak" />
        )}
      </Card>

      <Card>
        <h2 className="display m-0 text-[18px]">Pengguna baru 30 hari</h2>
        {newUsersByDay.length === 0 ? (
          <Alert>Belum ada pengguna baru.</Alert>
        ) : (
          <LineChart rows={newUsersByDay} label="pengguna baru" unit="puncak" />
        )}
      </Card>
    </>
  );
}
