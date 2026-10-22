"use client";

// Chart generik untuk dasbor root (Chart.js). Client-only: canvas digambar
// setelah mount. Satu komponen untuk line / bar / doughnut supaya konsisten.
import { useEffect, useRef } from "react";
import {
  Chart,
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
);

export const CHART_COLORS = ["#e85e43", "#71845a", "#6f9bb5", "#f5c94a", "#c98b8b", "#50643e", "#bf4429", "#9aa3a8"];

export interface ChartSeries {
  label: string;
  data: number[];
  color?: string;
}

export default function AnalyticsChart({
  type = "line",
  labels,
  series,
  ariaLabel,
  height = 220,
  horizontal = false,
}: {
  type?: "line" | "bar" | "doughnut";
  labels: string[];
  series: ChartSeries[];
  ariaLabel: string;
  height?: number;
  horizontal?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = `${type}|${labels.join("|")}|${series.map((s) => `${s.label}:${s.data.join(",")}`).join("|")}|${horizontal}`;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    chartRef.current?.destroy();
    const isDoughnut = type === "doughnut";
    chartRef.current = new Chart(el, {
      type,
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label,
          data: s.data,
          // Doughnut: 1 dataset tapi banyak irisan -> warna per irisan.
          backgroundColor: isDoughnut
            ? s.data.map((_, k) => CHART_COLORS[(i + k) % CHART_COLORS.length])
            : s.color ?? `${CHART_COLORS[i % CHART_COLORS.length]}cc`,
          borderColor: isDoughnut ? "#f7f4ec" : s.color ?? CHART_COLORS[i % CHART_COLORS.length],
          borderWidth: isDoughnut ? 2 : 0,
          fill: type === "line",
          tension: 0.4,
          borderRadius: type === "bar" ? 6 : 0,
          maxBarThickness: 42,
          pointRadius: type === "line" ? 0 : undefined,
          pointHoverRadius: type === "line" ? 4 : undefined,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? ("y" as const) : ("x" as const),
        animation: { duration: 500 },
        layout: { padding: 4 },
        scales: isDoughnut
          ? undefined
          : {
              x: {
                beginAtZero: true,
                grid: { display: false },
                ticks: { font: { size: 10 }, color: "#6c6b66", precision: 0, maxTicksLimit: 8 },
              },
              y: {
                beginAtZero: true,
                grid: { color: "rgba(23,23,22,.08)" },
                ticks: { font: { size: 10 }, color: "#6c6b66", precision: 0 },
              },
            },
        plugins: {
          legend: isDoughnut
            ? { position: "right", labels: { boxWidth: 10, font: { size: 11 } } }
            : { display: series.length > 1, labels: { boxWidth: 10, font: { size: 11 } } },
          tooltip: { intersect: false, mode: type === "line" ? "index" : "nearest" },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
