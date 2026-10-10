"use client";

import { useEffect, useRef, useState } from "react";

const FONT = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const THEMES = {
  light: { bg: "#f4f6f9", card: "#ffffff", text: "#1d2433", muted: "#5b6578", line: "#c5cedb", shadow: "rgba(30,40,60,.14)" },
  dark: { bg: "#141a26", card: "#1f2736", text: "#eef2f8", muted: "#9aa6bb", line: "#3a4558", shadow: "rgba(0,0,0,.45)" },
};
const PALETTE = ["#0f766e", "#2563eb", "#c2410c", "#7c3aed", "#be185d", "#4d7c0f"];
const STORE = "timeline-generator-v1";

type EventItem = {
  date: string;
  title: string;
  desc: string;
  color: string;
};

type State = {
  title: string;
  sub: string;
  layout: "vertical" | "horizontal";
  theme: "light" | "dark";
  scale: number;
  transparent: boolean;
  events: EventItem[];
};

export default function TimelineClient() {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<State>(() => {
    const fallback: State = {
      title: "Perjalanan Proyek Kami",
      sub: "Dari ide pertama sampai peluncuran",
      layout: "vertical",
      theme: "light",
      scale: 2,
      transparent: false,
      events: [
        { date: "Januari 2025", title: "Ide pertama", desc: "Tim berkumpul dan merumuskan masalah yang ingin diselesaikan.", color: PALETTE[0] },
        { date: "Maret 2025", title: "Prototipe", desc: "Versi awal dibuat dan diuji oleh sepuluh pengguna pertama.", color: PALETTE[1] },
        { date: "Juni 2025", title: "Beta tertutup", desc: "Dibuka untuk 200 pengguna undangan. Masukan dikumpulkan setiap minggu.", color: PALETTE[2] },
        { date: "Oktober 2025", title: "Peluncuran", desc: "Rilis publik pertama.", color: PALETTE[3] },
      ],
    };
    if (typeof window === "undefined") return fallback;
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s && Array.isArray(s.events)) return { ...fallback, ...s };
    } catch {}
    return fallback;
  });

  const [infoText, setInfoText] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(state));
    } catch {}
  }, [state]);

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
    const out: string[] = [];
    if (!text) return out;
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width <= maxW) {
          line = test;
          continue;
        }
        if (line) out.push(line);
        line = word;
        while (ctx.measureText(line).width > maxW && line.length > 1) {
          let k = line.length - 1;
          while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
          out.push(line.slice(0, k));
          line = line.slice(k);
        }
      }
      out.push(line);
    }
    return out;
  }

  const F = {
    date: "600 14px " + FONT,
    title: "700 20px " + FONT,
    desc: "400 15px " + FONT,
    h1: "700 40px " + FONT,
    h2: "400 18px " + FONT,
  };

  function measureCard(ctx: CanvasRenderingContext2D, ev: EventItem, w: number) {
    const inner = w - 36 - 6;
    ctx.font = F.title;
    const tl = wrapText(ctx, ev.title, inner);
    ctx.font = F.desc;
    const dl = wrapText(ctx, ev.desc, inner);
    const h = 18 + (ev.date ? 18 + 6 : 0) + tl.length * 26 + (dl.length ? 8 + dl.length * 22 : 0) + 18;
    return { tl, dl, h: Math.max(h, 60) };
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function buildLayout(ctx: CanvasRenderingContext2D) {
    const pad = 60;
    const evs = state.events;
    const n = evs.length;
    const horizontal = state.layout === "horizontal";
    const colW = 280;
    const cardW = horizontal ? 250 : 380;
    const W = horizontal ? Math.max(900, pad * 2 + n * colW) : 960;

    ctx.font = F.h1;
    const t = wrapText(ctx, state.title, W - pad * 2);
    ctx.font = F.h2;
    const s = wrapText(ctx, state.sub, W - pad * 2);
    const headH = pad + (t.length ? t.length * 50 : 0) + (s.length ? 8 + s.length * 26 : 0);
    const startY = headH + (t.length || s.length ? 40 : 0) + (horizontal ? 0 : 20);

    const items = evs.map((e, i) => ({ ev: e, i, ...measureCard(ctx, e, cardW), x: 0, y: 0, side: 0, cx: 0 }));
    let H: number;

    if (!horizontal) {
      const cx = W / 2;
      const bottoms = [startY, startY];
      let lastY = startY - 80;
      items.forEach((it, i) => {
        const side = i % 2;
        it.y = Math.max(lastY + 80, bottoms[side] + (i > 1 ? 24 : 0));
        it.x = side === 0 ? cx - 36 - cardW : cx + 36;
        it.side = side;
        bottoms[side] = it.y + it.h;
        lastY = it.y;
      });
      H = Math.max(startY, ...items.map((i) => i.y + i.h)) + pad;
      return { W, H, t, s, items, cx, startY, cardW, horizontal };
    }

    const above = Math.max(0, ...items.filter((_, i) => i % 2 === 0).map((i) => i.h));
    const below = Math.max(0, ...items.filter((_, i) => i % 2 === 1).map((i) => i.h));
    const lineY = startY + above + 50;
    const off = (W - n * colW) / 2;
    items.forEach((it, i) => {
      it.cx = off + i * colW + colW / 2;
      it.x = it.cx - cardW / 2;
      it.side = i % 2;
      it.y = it.side === 0 ? lineY - 50 - it.h : lineY + 50;
    });
    H = lineY + 50 + below + pad;
    return { W, H, t, s, items, lineY, off, n, colW, cardW, horizontal };
  }

  function drawCanvas(canvas: HTMLCanvasElement, scale: number) {
    const m = document.createElement("canvas").getContext("2d");
    if (!m) return;
    const L = buildLayout(m);
    canvas.width = Math.round(L.W * scale);
    canvas.height = Math.round(L.H * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const T = THEMES[state.theme];

    if (!state.transparent) {
      ctx.fillStyle = T.bg;
      ctx.fillRect(0, 0, L.W, L.H);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let y = 60;
    ctx.fillStyle = T.text;
    ctx.font = F.h1;
    L.t.forEach((ln, i) => ctx.fillText(ln, L.W / 2, y + 34 + i * 50));
    y += L.t.length * 50;
    if (L.s.length) {
      ctx.fillStyle = T.muted;
      ctx.font = F.h2;
      L.s.forEach((ln, i) => ctx.fillText(ln, L.W / 2, y + 8 + 19 + i * 26));
    }
    ctx.textAlign = "left";

    const items = L.items;
    if (!items.length) return;

    // garis utama
    ctx.strokeStyle = T.line;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (!L.horizontal) {
      ctx.moveTo(L.cx!, items[0].y + 30);
      ctx.lineTo(L.cx!, items[items.length - 1].y + 30);
    } else {
      ctx.moveTo(L.off! + L.colW! / 2, L.lineY!);
      ctx.lineTo(L.off! + (L.n! - 1) * L.colW! + L.colW! / 2, L.lineY!);
    }
    ctx.stroke();

    items.forEach((it) => {
      const c = it.ev.color || PALETTE[0];
      let dx: number, dy: number;
      if (!L.horizontal) {
        dx = L.cx!;
        dy = it.y + 30;
      } else {
        dx = it.cx;
        dy = L.lineY!;
      }
      // konektor
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (!L.horizontal) {
        ctx.moveTo(dx, dy);
        ctx.lineTo(it.side === 0 ? it.x + L.cardW : it.x, dy);
      } else {
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx, it.side === 0 ? it.y + it.h : it.y);
      }
      ctx.stroke();
      // kartu
      ctx.save();
      ctx.shadowColor = T.shadow;
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = T.card;
      roundRect(ctx, it.x, it.y, L.cardW, it.h, 10);
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundRect(ctx, it.x, it.y, L.cardW, it.h, 10);
      ctx.clip();
      ctx.fillStyle = c;
      ctx.fillRect(it.x, it.y, 6, it.h);
      ctx.restore();
      // isi
      let ty = it.y + 18;
      const tx = it.x + 24;
      ctx.textBaseline = "top";
      if (it.ev.date) {
        ctx.fillStyle = c;
        ctx.font = F.date;
        ctx.fillText(it.ev.date, tx, ty);
        ty += 24;
      }
      ctx.fillStyle = T.text;
      ctx.font = F.title;
      it.tl.forEach((ln) => {
        ctx.fillText(ln, tx, ty + 3);
        ty += 26;
      });
      if (it.dl.length) {
        ty += 8;
        ctx.fillStyle = T.muted;
        ctx.font = F.desc;
        it.dl.forEach((ln) => {
          ctx.fillText(ln, tx, ty + 2);
          ty += 22;
        });
      }
      ctx.textBaseline = "alphabetic";
      // titik
      ctx.fillStyle = state.transparent ? T.card : T.bg;
      ctx.beginPath();
      ctx.arc(dx, dy, 11, 0, 7);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(dx, dy, 7, 0, 7);
      ctx.fill();
    });
  }

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    drawCanvas(cv, 2);
    const w = cv.width / 2;
    if (state.layout === "horizontal") {
      cv.style.width = w + "px";
      cv.style.maxWidth = "none";
    } else {
      cv.style.width = "100%";
      cv.style.maxWidth = w + "px";
    }
    const px = Math.round(w * state.scale) + " × " + Math.round((cv.height / 2) * state.scale) + " px";
    setInfoText("Ukuran PNG: " + px + ". Data tersimpan otomatis di browser.");
  }, [state]);

  function downloadPNG() {
    const off = document.createElement("canvas");
    drawCanvas(off, state.scale);
    off.toBlob((blob) => {
      if (!blob) {
        alert("Gagal membuat PNG. Coba kurangi resolusi.");
        return;
      }
      const slug = (state.title || "timeline")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "timeline";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slug + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  }

  function addEvent() {
    setState((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        { date: "", title: "Peristiwa baru", desc: "", color: PALETTE[prev.events.length % PALETTE.length] },
      ],
    }));
  }

  function updateEvent(idx: number, patch: Partial<EventItem>) {
    setState((prev) => {
      const next = [...prev.events];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, events: next };
    });
  }

  function moveEvent(idx: number, dir: -1 | 1) {
    setState((prev) => {
      const next = [...prev.events];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return { ...prev, events: next };
    });
  }

  function deleteEvent(idx: number) {
    setState((prev) => {
      const next = prev.events.filter((_, i) => i !== idx);
      return { ...prev, events: next };
    });
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid rgba(23,23,22,.18)",
    borderRadius: 8,
    fontSize: 14,
    background: "#fffdf8",
    color: "#171716",
  };

  return (
    <div style={{ padding: "20px clamp(16px, 4vw, 40px) 48px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: 24, alignItems: "start" }} className="timeline-grid">
        {/* PANEL EDITOR */}
        <aside className="card" style={{ padding: 20, display: "grid", gap: 14, background: "#fffdf8", border: "1px solid rgba(23,23,22,.16)", borderRadius: 20 }}>
          <h1 className="display" style={{ fontSize: 20, margin: 0 }}>Generator Timeline PNG</h1>

          <label style={{ display: "grid", gap: 4, fontSize: 13, color: "#74746d" }}>
            Judul
            <input type="text" value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} style={fieldStyle} />
          </label>

          <label style={{ display: "grid", gap: 4, fontSize: 13, color: "#74746d" }}>
            Subjudul (opsional)
            <input type="text" value={state.sub} onChange={(e) => setState((p) => ({ ...p, sub: e.target.value }))} style={fieldStyle} />
          </label>

          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 0" }}>Tampilan</h2>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#74746d" }}>Arah Layout</span>
            <div style={{ display: "flex", border: "1px solid rgba(23,23,22,.18)", borderRadius: 8, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, layout: "vertical" }))}
                style={{ flex: 1, padding: 8, border: "none", background: state.layout === "vertical" ? "#171716" : "#fffdf8", color: state.layout === "vertical" ? "#fffdf8" : "#171716", fontWeight: 700, cursor: "pointer" }}
              >
                Vertikal
              </button>
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, layout: "horizontal" }))}
                style={{ flex: 1, padding: 8, border: "none", background: state.layout === "horizontal" ? "#171716" : "#fffdf8", color: state.layout === "horizontal" ? "#fffdf8" : "#171716", fontWeight: 700, cursor: "pointer" }}
              >
                Horizontal
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#74746d" }}>Tema Warna</span>
            <div style={{ display: "flex", border: "1px solid rgba(23,23,22,.18)", borderRadius: 8, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, theme: "light" }))}
                style={{ flex: 1, padding: 8, border: "none", background: state.theme === "light" ? "#171716" : "#fffdf8", color: state.theme === "light" ? "#fffdf8" : "#171716", fontWeight: 700, cursor: "pointer" }}
              >
                Terang
              </button>
              <button
                type="button"
                onClick={() => setState((p) => ({ ...p, theme: "dark" }))}
                style={{ flex: 1, padding: 8, border: "none", background: state.theme === "dark" ? "#171716" : "#fffdf8", color: state.theme === "dark" ? "#fffdf8" : "#171716", fontWeight: 700, cursor: "pointer" }}
              >
                Gelap
              </button>
            </div>
          </div>

          <label style={{ display: "grid", gap: 4, fontSize: 13, color: "#74746d" }}>
            Resolusi PNG
            <select value={state.scale} onChange={(e) => setState((p) => ({ ...p, scale: Number(e.target.value) }))} style={fieldStyle}>
              <option value={1}>1x (standar)</option>
              <option value={2}>2x (tajam)</option>
              <option value={3}>3x (cetak / HD)</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={state.transparent} onChange={(e) => setState((p) => ({ ...p, transparent: e.target.checked }))} />
            Latar belakang transparan
          </label>

          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 0" }}>Daftar Peristiwa</h2>

          <div style={{ display: "grid", gap: 10 }}>
            {state.events.map((ev, i) => (
              <div key={i} style={{ border: "1px solid rgba(23,23,22,.16)", borderRadius: 12, padding: 10, borderLeft: `5px solid ${ev.color}`, display: "grid", gap: 8, background: "#fff" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="text"
                    value={ev.date}
                    placeholder="Tanggal / periode"
                    onChange={(e) => updateEvent(i, { date: e.target.value })}
                    style={{ ...fieldStyle, flex: 1 }}
                  />
                  <input
                    type="color"
                    value={ev.color}
                    onChange={(e) => updateEvent(i, { color: e.target.value })}
                    style={{ width: 38, height: 36, padding: 2, border: "1px solid rgba(23,23,22,.18)", borderRadius: 6, cursor: "pointer" }}
                  />
                </div>
                <input
                  type="text"
                  value={ev.title}
                  placeholder="Judul peristiwa"
                  onChange={(e) => updateEvent(i, { title: e.target.value })}
                  style={fieldStyle}
                />
                <textarea
                  value={ev.desc}
                  placeholder="Deskripsi singkat"
                  rows={2}
                  onChange={(e) => updateEvent(i, { desc: e.target.value })}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn-sticker btn-ghost" onClick={() => moveEvent(i, -1)} disabled={i === 0} style={{ padding: "4px 8px", fontSize: 12 }}>Naik</button>
                  <button type="button" className="btn-sticker btn-ghost" onClick={() => moveEvent(i, 1)} disabled={i === state.events.length - 1} style={{ padding: "4px 8px", fontSize: 12 }}>Turun</button>
                  <button type="button" className="btn-sticker btn-ghost" onClick={() => deleteEvent(i)} style={{ padding: "4px 8px", fontSize: 12, color: "#e85e43", marginLeft: "auto" }}>Hapus</button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn-sticker btn-ghost" onClick={addEvent} style={{ width: "100%", justifyContent: "center", borderStyle: "dashed" }}>
            + Tambah Peristiwa
          </button>

          <button type="button" className="btn-sticker btn-primary" onClick={downloadPNG} style={{ width: "100%", justifyContent: "center", minHeight: 46 }}>
            Unduh Gambar PNG ↗
          </button>
          {infoText && <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>{infoText}</p>}
        </aside>

        {/* PANEL PREVIEW CANVAS */}
        <main className="card" style={{ padding: 16, background: "#fffdf8", borderRadius: 20, border: "1px solid rgba(23,23,22,.16)", overflow: "auto", textAlign: "center" }}>
          <canvas ref={cvRef} style={{ display: "block", margin: "0 auto", boxShadow: "0 4px 16px rgba(23,23,22,.12)", background: "repeating-conic-gradient(#fff 0 25%, #eef1f5 0 50%) 0 0/16px 16px" }} />
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .timeline-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}