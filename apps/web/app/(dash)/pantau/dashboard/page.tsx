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
}

interface Analytics {
  period?: string;
  counts?: Totals;
  byDay?: DayRow[];
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
function LineChart({ rows }: { rows: DayRow[] }) {
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
        aria-label={`Grafik kehadiran ${values.length} hari terakhir`}
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
        <span>puncak {max.toLocaleString("id-ID")}</span>
        <span>{rows[rows.length - 1]?.date?.slice(0, 10) ?? "–"}</span>
      </div>
    </div>
  );
}

export default function PantauDashboardPage() {
  const analytics = useFetch<Analytics>("/api/root/analytics");
  const schools = useFetch<SchoolsResponse>("/api/root/schools");
  const t = analytics.data?.counts ?? {};
  const byDay = analytics.data?.byDay ?? [];
  const schoolCount = t.class ?? schools.data?.total ?? schools.data?.schools?.length;

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
        ]}
      />

      <Card>
        <h2 className="display m-0 text-[18px]">Kehadiran 30 hari</h2>
        {byDay.length === 0 ? (
          <Alert>Belum ada data kehadiran.</Alert>
        ) : (
          <LineChart rows={byDay} />
        )}
      </Card>
    </>
  );
}
