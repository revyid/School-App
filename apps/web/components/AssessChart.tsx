"use client";

// Bar chart persentase benar per soal (Chart.js). Client-only.
import { useEffect, useRef } from "react";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

function barColor(pct: number): string {
  if (pct >= 70) return "#50643e";
  if (pct >= 40) return "#f5c94a";
  return "#e85e43";
}

export default function AssessChart({ labels, pcts, counts }: { labels: string[]; pcts: number[]; counts?: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = labels.join("|") + "#" + pcts.join(",");

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(el, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "% benar",
            data: pcts,
            backgroundColor: pcts.map(barColor),
            borderRadius: 6,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600 },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { callback: (v) => `${v}%` },
            grid: { color: "rgba(23,23,22,.08)" },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const i = ctx.dataIndex;
                const n = counts?.[i];
                return ` ${ctx.parsed.y}% benar${n != null ? ` (n=${n})` : ""}`;
              },
            },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas ref={canvasRef} style={{ maxWidth: "100%" }} aria-label="Chart persentase benar per soal" />;
}
