"use client";

// Spline chart persentase benar per soal (Chart.js line + tension). Client-only.
// Garis melengkung (tidak lancip): tension 0.45, titik bulat, area fill lembut.
import { useEffect, useRef } from "react";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
} from "chart.js";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

export default function AssessChart({ labels, pcts, counts }: { labels: string[]; pcts: number[]; counts?: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const key = labels.join("|") + "#" + pcts.join(",");

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(el, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "% benar",
            data: pcts,
            borderColor: "#50643e",
            backgroundColor: "rgba(80,100,62,.14)",
            fill: true,
            tension: 0.45,
            borderWidth: 2.5,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: "#50643e",
            pointBorderColor: "#fffdf8",
            pointBorderWidth: 2,
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

  return <canvas ref={canvasRef} className="max-w-full" aria-label="Chart persentase benar per soal" />;
}
