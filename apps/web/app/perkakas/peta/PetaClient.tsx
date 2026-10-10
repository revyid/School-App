"use client";

// Pembuat Peta Digital (tanpa login): canvas 2D + tile OpenStreetMap + routing OSRM.
// Kamera: ikuti kendaraan / pas di layar. Jalur: otomatis / darat / air.
// Kendaraan per titik: otomatis / mobil / motor / bus / kapal / pesawat / sepeda / jalan kaki.
// Ekspor video + PNG + preset JSON. State tersimpan di localStorage.
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";

type Veh = "auto" | "mobil" | "motor" | "bus" | "kapal" | "pesawat" | "sepeda" | "jalan";
const VEH_LABEL: Record<Veh, string> = {
  auto: "Otomatis",
  mobil: "Mobil",
  motor: "Motor",
  bus: "Bus",
  kapal: "Kapal",
  pesawat: "Pesawat",
  sepeda: "Sepeda",
  jalan: "Jalan kaki",
};
const VEH_SHORT: Record<Exclude<Veh, "auto">, string> = {
  mobil: "MBL",
  motor: "MTR",
  bus: "BUS",
  kapal: "KPL",
  pesawat: "PSW",
  sepeda: "SPD",
  jalan: "JLN",
};

type Pin = { id: number; lat: number; lng: number; name: string; veh: Veh };
type CamMode = "follow" | "fit";
type RouteMode = "auto" | "darat" | "air";
type SearchHit = { place_id: number; display_name: string; lat: string; lon: string };

const LS_KEY = "peta-tools-v2";

export default function PetaClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const eng = useRef({
    cx: (106.8456 + 180) / 360,
    cy: 0,
    z: 12,
    pins: [] as Pin[],
    uid: 1,
    loop: false,
    playing: true,
    dark: false,
    cam: "follow" as CamMode,
    mode: "auto" as RouteMode,
    speed: 1,
    T: 0,
    last: 0,
    exporting: false,
    status: "",
    route: null as { pts: { x: number; y: number }[]; cum: number[]; total: number } | null,
    routeKey: "",
    effective: "darat" as "darat" | "air",
    effectiveKey: "",
    straight: null as { pts: { x: number; y: number }[]; cum: number[]; total: number } | null,
    straightKey: "",
    pending: "",
    timer: 0,
    routeM: 0,
    stopRec: null as (() => void) | null,
    wasPlaying: true,
    cache: new Map<string, { img: HTMLImageElement; ok: boolean }>(),
    defaultVeh: "auto" as Veh,
    drag: null as null | { sx: number; sy: number; cx: number; cy: number; pin: number; moved: boolean },
  });

  const [playing, setPlaying] = useState(true);
  const [loop, setLoop] = useState(false);
  const [dark, setDark] = useState(false);
  const [cam, setCam] = useState<CamMode>("follow");
  const [mode, setMode] = useState<RouteMode>("auto");
  const [speed, setSpeed] = useState(1);
  const [status, setStatusText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [defaultVeh, setDefaultVeh] = useState<Veh>("auto");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [confirmHapusSemua, setConfirmHapusSemua] = useState(false);

  const mx = (lng: number) => (lng + 180) / 360;
  const my = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
  };

  function syncFromEngine() {
    const E = eng.current;
    setPlaying(E.playing);
    setLoop(E.loop);
    setDark(E.dark);
    setCam(E.cam);
    setMode(E.mode);
    setSpeed(E.speed);
    setDefaultVeh(E.defaultVeh);
    setStatusText(E.status);
  }

  function commit(patch: Partial<{ cam: CamMode; mode: RouteMode; speed: number; loop: boolean; playing: boolean; dark: boolean; defaultVeh: Veh }>) {
    const E = eng.current;
    Object.assign(E, patch);
    (E as { _save?: () => void })._save?.();
    if (patch.mode !== undefined || patch.loop !== undefined) (E as { _updateRoute?: () => void })._updateRoute?.();
    if (patch.cam === "fit") requestAnimationFrame(() => fitView());
    syncFromEngine();
  }

  function fitView() {
    const E = eng.current;
    const wrap = wrapRef.current;
    const W = wrap?.clientWidth || 800;
    const H = wrap?.clientHeight || 500;
    const pts = E.pins.map((p) => ({ x: mx(p.lng), y: my(p.lat) }));
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const a = Math.min(...xs);
    const b = Math.max(...xs);
    const c = Math.min(...ys);
    const d = Math.max(...ys);
    E.cx = (a + b) / 2;
    E.cy = (c + d) / 2;
    const dx = Math.max(b - a, 1e-7);
    const dy = Math.max(d - c, 1e-7);
    E.z = Math.max(2, Math.min(pts.length > 1 ? 17 : 14, Math.log2(Math.min((W - 120) / (dx * 256), (H - 160) / (dy * 256)))));
    (E as { _save?: () => void })._save?.();
  }

  useEffect(() => {
    const E = eng.current;
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const wrap = wrapRef.current!;
    let W = 0;
    let H = 0;
    let DPR = 1;
    E.cy = my(-6.2088);

    const toLng = (x: number) => x * 360 - 180;
    const toLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
    const S = () => 256 * Math.pow(2, E.z);
    const toS = (nx: number, ny: number) => ({ x: W / 2 + (nx - E.cx) * S(), y: H / 2 + (ny - E.cy) * S() });
    const toN = (px: number, py: number) => ({ x: E.cx + (px - W / 2) / S(), y: E.cy + (py - H / 2) / S() });
    const pinS = (p: Pin) => toS(mx(p.lng), my(p.lat));

    function resize() {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      cv.width = (Math.round((W * DPR) >> 1) << 1) || 2;
      cv.height = (Math.round((H * DPR) >> 1) << 1) || 2;
      cv.style.width = W + "px";
      cv.style.height = H + "px";
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (d) {
        E.pins = (d.pins || []).map((p: Pin) => ({ ...p, veh: (p.veh || "auto") as Veh }));
        E.uid = d.uid || 1;
        if (d.view) {
          E.cx = d.view.cx ?? E.cx;
          E.cy = d.view.cy ?? E.cy;
          E.z = d.view.z ?? E.z;
        }
        E.loop = !!d.loop;
        if (d.cam) E.cam = d.cam;
        if (d.mode) E.mode = d.mode;
        if (d.speed) E.speed = d.speed;
        if (d.defaultVeh) E.defaultVeh = d.defaultVeh;
      }
    } catch {}
    try {
      const old = JSON.parse(localStorage.getItem("peta-tools-v1") || "null");
      if (old && (!E.pins || E.pins.length === 0) && old.pins?.length) {
        E.pins = old.pins.map((p: Pin) => ({ ...p, veh: (p.veh && p.veh !== "mobil" ? p.veh : "auto") as Veh }));
        E.uid = old.uid || E.pins.length + 1;
      }
    } catch {}
    E.dark = window.matchMedia("(prefers-color-scheme:dark)").matches;
    syncFromEngine();

    const save = () => {
      try {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            pins: E.pins,
            uid: E.uid,
            view: { cx: E.cx, cy: E.cy, z: E.z },
            loop: E.loop,
            cam: E.cam,
            mode: E.mode,
            speed: E.speed,
            defaultVeh: E.defaultVeh,
          }),
        );
      } catch {}
    };
    (E as { _save?: () => void })._save = save;

    const setEngineStatus = (s: string) => {
      E.status = s;
      setStatusText(s);
    };

    // ---- tile OpenStreetMap only ----
    const tkey = (tz: number, x: number, y: number) => "osm" + tz + "/" + x + "/" + y;
    function tile(tz: number, x: number, y: number) {
      const k = tkey(tz, x, y);
      let t = E.cache.get(k);
      if (!t) {
        if (E.cache.size > 700) {
          const first = E.cache.keys().next().value;
          if (first) E.cache.delete(first);
        }
        const img = new Image();
        const rec = { img, ok: false };
        img.crossOrigin = "anonymous";
        img.onload = () => {
          rec.ok = true;
        };
        img.onerror = () => {};
        img.src = `https://tile.openstreetmap.org/${tz}/${x}/${y}.png`;
        E.cache.set(k, rec);
        t = rec;
      }
      return t;
    }
    function drawTiles() {
      ctx.fillStyle = E.dark ? "#0e1116" : "#e8e4dc";
      ctx.fillRect(0, 0, W, H);
      const s = S();
      const tz = Math.max(0, Math.min(19, Math.floor(E.z)));
      const n = 1 << tz;
      const ts = s / n;
      const x0 = Math.floor((E.cx - W / 2 / s) * n);
      const x1 = Math.floor((E.cx + W / 2 / s) * n);
      const y0 = Math.max(0, Math.floor((E.cy - H / 2 / s) * n));
      const y1 = Math.min(n - 1, Math.floor((E.cy + H / 2 / s) * n));
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++) {
          const wx = ((x % n) + n) % n;
          const px = W / 2 + (x / n - E.cx) * s;
          const py = H / 2 + (y / n - E.cy) * s;
          const t = tile(tz, wx, y);
          if (t.ok) {
            ctx.drawImage(t.img, px, py, ts + 0.5, ts + 0.5);
            continue;
          }
          for (let k = 1; k <= 3 && tz - k >= 0; k++) {
            const pt = E.cache.get(tkey(tz - k, wx >> k, y >> k));
            if (pt && pt.ok) {
              const m = 1 << k;
              const sw = pt.img.naturalWidth / m;
              ctx.drawImage(pt.img, (wx % m) * sw, (y % m) * sw, sw, sw, px, py, ts + 0.5, ts + 0.5);
              break;
            }
          }
        }
      ctx.font = "11px system-ui";
      ctx.textAlign = "right";
      ctx.fillStyle = E.dark ? "#ffffffaa" : "#000000aa";
      ctx.fillText("OpenStreetMap contributors", W - 8, H - 6);
    }

    // ---- rute stabil: tahan rute lama selama fetch, tanpa kedip ----
    const coords = () => {
      const c = E.pins.map((p) => [p.lng, p.lat]);
      if (E.loop && c.length > 2) c.push(c[0]);
      return c;
    };
    const keyOf = () => E.mode + "|" + (E.loop ? "L" : "-") + "|" + coords().map((c) => c[0].toFixed(5) + "," + c[1].toFixed(5)).join(";");
    function mkPD(pts: { x: number; y: number }[]) {
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      return { pts, cum, total: cum[cum.length - 1] || 0 };
    }
    function straightPD() {
      const k = keyOf();
      if (E.straightKey !== k || !E.straight) {
        E.straightKey = k;
        E.straight = coords().length > 1 ? mkPD(coords().map((c) => ({ x: mx(c[0]), y: my(c[1]) }))) : null;
      }
      return E.straight;
    }
    function getPD() {
      if (E.mode === "air") return straightPD();
      // Ada rute jalan tersimpan: tampilkan terus agar tidak berkedip,
      // walau pin baru digeser dan fetch pengganti masih jalan.
      if (E.route) return E.route;
      if (E.mode === "auto" && E.effectiveKey === keyOf() && E.effective === "air") return straightPD();
      return straightPD();
    }
    function effectiveNow(): "darat" | "air" {
      if (E.mode === "darat") return "darat";
      if (E.mode === "air") return "air";
      if (E.effectiveKey === keyOf()) return E.effective;
      return E.routeKey === keyOf() && E.route ? "darat" : "air";
    }
    function updateRoute() {
      clearTimeout(E.timer);
      const k = keyOf();
      if (coords().length < 2) {
        E.route = null;
        E.routeKey = "";
        E.effectiveKey = "";
        setEngineStatus("");
        return;
      }
      if (E.mode === "air") {
        E.route = null;
        E.routeKey = k;
        const pd = straightPD();
        if (pd) {
          const km = pd.total * 40075 * Math.cos(((E.pins[0] ? E.pins[0].lat : 0) * Math.PI) / 180);
          setEngineStatus("Jalur udara atau laut, garis langsung, sekitar " + km.toFixed(1) + " km");
        }
        if (!E.T) E.T = 0;
        return;
      }
      if (k === E.routeKey || k === E.effectiveKey || k === E.pending) return;
      E.timer = window.setTimeout(async () => {
        // Pertahankan gambar rute lama, hanya status yang berubah.
        setEngineStatus(E.route ? "Memperbarui rute jalan..." : "Mencari rute jalan terdekat...");
        E.pending = k;
        try {
          const r = await fetch(
            "https://router.project-osrm.org/route/v1/driving/" +
              coords().map((c) => c[0] + "," + c[1]).join(";") +
              "?overview=full&geometries=geojson",
          );
          const j = await r.json();
          if (E.pending !== k) return;
          if (j.code !== "Ok" || !j.routes?.[0]) throw 0;
          E.route = mkPD(j.routes[0].geometry.coordinates.map((c: number[]) => ({ x: mx(c[0]), y: my(c[1]) })));
          E.routeKey = k;
          E.effective = "darat";
          E.effectiveKey = k;
          E.routeM = j.routes[0].distance;
          setEngineStatus("Rute jalan " + (j.routes[0].distance / 1000).toFixed(1) + " km");
        } catch {
          if (E.pending !== k) return;
          E.effective = "air";
          E.effectiveKey = k;
          straightPD();
          setEngineStatus(
            E.mode === "auto"
              ? "Tidak ada jalan darat, memakai jalur laut atau udara"
              : "Rute jalan tidak ditemukan, memakai garis lurus",
          );
        }
        if (E.pending === k && !E.T) E.T = 0;
      }, 600);
    }
    (E as { _updateRoute?: () => void })._updateRoute = updateRoute;

    const atPos = (pd: { pts: { x: number; y: number }[]; cum: number[] }, d: number) => {
      let i = 1;
      while (i < pd.cum.length - 1 && pd.cum[i] < d) i++;
      const sg = pd.cum[i] - pd.cum[i - 1] || 1;
      const t = Math.min(1, (d - pd.cum[i - 1]) / sg);
      const a = pd.pts[i - 1];
      const b = pd.pts[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    };
    const resolveVeh = (v: Veh): Exclude<Veh, "auto"> => {
      if (v !== "auto") return v;
      if (E.defaultVeh !== "auto") return E.defaultVeh;
      return effectiveNow() === "air" ? "kapal" : "mobil";
    };
    const vehAt = (pd: { cum: number[] }, d: number): Exclude<Veh, "auto"> => {
      let i = 1;
      while (i < pd.cum.length - 1 && pd.cum[i] < d) i++;
      const segIdx = Math.min(i - 1, E.pins.length - 1);
      return resolveVeh(E.pins[Math.max(0, segIdx)]?.veh ?? "auto");
    };
    function partial(pd: { pts: { x: number; y: number }[]; cum: number[] }, d: number) {
      const out = [pd.pts[0]];
      for (let i = 1; i < pd.pts.length; i++) {
        if (pd.cum[i] <= d) out.push(pd.pts[i]);
        else {
          const t = (d - pd.cum[i - 1]) / (pd.cum[i] - pd.cum[i - 1] || 1);
          const a = pd.pts[i - 1];
          const b = pd.pts[i];
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
          break;
        }
      }
      return out;
    }
    function durOf(pd: { total: number }) {
      const km = pd.total * 40075 * Math.cos(((E.pins[0] ? E.pins[0].lat : 0) * Math.PI) / 180);
      return Math.max(6, Math.min(30, 5 + Math.sqrt(km) * 1.2));
    }

    // Kendaraan digambar sebagai bentuk, bukan emoji.
    function drawVehicle(x: number, y: number, ang: number, veh: Exclude<Veh, "auto">) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath();
      ctx.ellipse(2, 4, 16, 8, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#e85e43";
      ctx.beginPath();
      if (veh === "kapal") {
        ctx.moveTo(-14, -6);
        ctx.lineTo(14, -6);
        ctx.lineTo(9, 8);
        ctx.lineTo(-9, 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(-4, -12, 8, 6);
      } else if (veh === "pesawat") {
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -9);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 9);
        ctx.closePath();
        ctx.fill();
      } else if (veh === "bus") {
        const rr = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
        if (rr.roundRect) rr.roundRect(-15, -8, 30, 16, 5);
        else ctx.rect(-15, -8, 30, 16);
        ctx.fill();
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(-11, -4, 22, 4);
      } else if (veh === "motor" || veh === "sepeda") {
        ctx.arc(-6, 5, 5, 0, 7);
        ctx.arc(8, 5, 5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#171716";
        ctx.fillRect(-8, -6, 14, 5);
      } else {
        const rr = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
        if (rr.roundRect) rr.roundRect(-13, -7, 26, 14, 5);
        else ctx.rect(-13, -7, 26, 14);
        ctx.fill();
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(2, -5, 6, 10);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(x, y - 22);
      const label = VEH_SHORT[veh];
      ctx.font = "700 10px 'DM Mono', monospace";
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = E.dark ? "#171716" : "#fffdf8";
      ctx.strokeStyle = "#171716";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const rr2 = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
      if (rr2.roundRect) rr2.roundRect(-w / 2, -10, w, 18, 9);
      else ctx.rect(-w / 2, -10, w, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = E.dark ? "#fffdf8" : "#171716";
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 3);
      ctx.restore();
    }

    const HOLD = 90;
    let raf = 0;
    function frame(ts: number) {
      const dt = Math.min(100, ts - E.last) * 0.06;
      E.last = ts;
      if (E.playing || E.exporting) E.T += dt * E.speed;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawTiles();
      const rc = E.dark ? "#5aa9ff" : "#2a7de1";
      const pd = getPD();
      let done = false;
      if (pd && pd.total > 0) {
        const D = durOf(pd) * 60;
        const F = D + HOLD;
        if (E.exporting && E.T >= F) {
          E.T = F - 0.01;
          done = true;
        }
        const f = E.T % F;
        const dist = Math.min(f / D, 1) * pd.total;
        const sp = partial(pd, dist).map((p) => toS(p.x, p.y));
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.setLineDash([]);
        ctx.beginPath();
        sp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.strokeStyle = rc + "55";
        ctx.lineWidth = 11;
        ctx.stroke();
        ctx.strokeStyle = rc;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.strokeStyle = "#ffffffaa";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 12]);
        ctx.lineDashOffset = -E.T * 0.8;
        ctx.stroke();
        ctx.setLineDash([]);
        const q = atPos(pd, dist);
        if (E.cam === "follow" && (E.playing || E.exporting)) {
          E.cx += (q.x - E.cx) * 0.12;
          E.cy += (q.y - E.cy) * 0.12;
        }
        const s = toS(q.x, q.y);
        drawVehicle(s.x, s.y, q.ang, vehAt(pd, dist));
        if (E.exporting) setProgress(Math.round(Math.min(1, E.T / F) * 100) + "%");
      }
      E.pins.forEach((p, i) => {
        const s = pinS(p);
        const ph = (E.T * 0.02 + i * 0.3) % 1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 10 + ph * 22, 0, 7);
        ctx.strokeStyle = "rgba(232,94,67," + (0.7 * (1 - ph)).toFixed(2) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.fillStyle = "rgba(0,0,0,.25)";
        ctx.beginPath();
        ctx.ellipse(0, 2, 9, 4, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#e85e43";
        ctx.beginPath();
        ctx.arc(0, -22, 13, Math.PI * 0.8, Math.PI * 0.2, false);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fffdf8";
        ctx.beginPath();
        ctx.arc(0, -22, 6, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#e85e43";
        ctx.font = "700 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), 0, -19);
        const tag = resolveVeh(p.veh);
        ctx.font = "600 12px system-ui";
        const label = (p.name || "Lokasi") + " [" + VEH_SHORT[tag] + "]";
        const w = ctx.measureText(label).width + 12;
        ctx.fillStyle = E.dark ? "rgba(0,0,0,.8)" : "rgba(255,253,248,.92)";
        ctx.beginPath();
        const rr3 = ctx as CanvasRenderingContext2D & { roundRect?: (...a: number[]) => void };
        if (rr3.roundRect) rr3.roundRect(-w / 2, -60, w, 19, 6);
        else ctx.rect(-w / 2, -60, w, 19);
        ctx.fill();
        ctx.fillStyle = E.dark ? "#fff" : "#171716";
        ctx.fillText(label, 0, -46);
        ctx.restore();
      });
      if (done && E.exporting) setTimeout(() => E.stopRec?.(), 400);
      raf = requestAnimationFrame(frame);
    }

    // ---- interaksi ----
    const hit = (px: number, py: number) => {
      for (let i = E.pins.length - 1; i >= 0; i--) {
        const s = pinS(E.pins[i]);
        if (Math.hypot(px - s.x, py - (s.y - 20)) < 20) return i;
      }
      return -1;
    };
    const llAt = (px: number, py: number) => {
      const n = toN(px, py);
      return { lng: toLng(n.x), lat: toLat(n.y) };
    };
    const onDown = (e: PointerEvent) => {
      if (E.exporting) return;
      cv.setPointerCapture(e.pointerId);
      const r = cv.getBoundingClientRect();
      E.drag = { sx: e.clientX, sy: e.clientY, cx: E.cx, cy: E.cy, pin: hit(e.clientX - r.left, e.clientY - r.top), moved: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!E.drag) return;
      const dx = e.clientX - E.drag.sx;
      const dy = e.clientY - E.drag.sy;
      if (Math.hypot(dx, dy) > 4) E.drag.moved = true;
      if (!E.drag.moved) return;
      if (E.drag.pin >= 0) {
        const r = cv.getBoundingClientRect();
        const l = llAt(e.clientX - r.left, e.clientY - r.top + 20);
        E.pins[E.drag.pin].lat = l.lat;
        E.pins[E.drag.pin].lng = l.lng;
      } else {
        E.cx = E.drag.cx - dx / S();
        E.cy = E.drag.cy - dy / S();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!E.drag) return;
      const r = cv.getBoundingClientRect();
      if (!E.drag.moved && E.drag.pin < 0) {
        const l = llAt(e.clientX - r.left, e.clientY - r.top);
        addPin(l.lat, l.lng);
      } else if (E.drag.moved) {
        if (E.drag.pin >= 0) updateRoute();
        save();
      }
      E.drag = null;
    };
    function zoomAt(px: number, py: number, dz: number) {
      const n = toN(px, py);
      E.z = Math.max(2, Math.min(19, E.z + dz));
      E.cx = n.x - (px - W / 2) / S();
      E.cy = n.y - (py - H / 2) / S();
      save();
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 0.3 : -0.3);
    };
    function addPin(lat: number, lng: number, name?: string) {
      E.pins.push({ id: E.uid, lat, lng, name: name || "Lokasi " + E.uid, veh: E.defaultVeh });
      E.uid++;
      save();
      syncFromEngine();
      updateRoute();
    }
    (E as { _addPin?: typeof addPin })._addPin = addPin;
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("wheel", onWheel, { passive: false });

    updateRoute();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(E.timer);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(q: string) {
    const E = eng.current;
    const text = (q || query).trim();
    if (!text) return;
    setSearching(true);
    setSearchMsg("Mencari...");
    setHits([]);
    try {
      const span = 360 / Math.pow(2, E.z);
      const left = E.cx * 360 - 180 - span;
      const right = E.cx * 360 - 180 + span;
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&viewbox=" +
        [left, 90, right, -90].join(",") +
        "&bounded=0&q=" +
        encodeURIComponent(text);
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      const j = (await r.json()) as SearchHit[];
      if (!j.length) {
        setSearchMsg("Tidak ketemu. Coba kata kunci lain, misal nama kota atau landmark.");
      } else {
        setSearchMsg(j.length + " hasil. Pilih salah satu agar tepat sasaran.");
        setHits(j);
      }
    } catch {
      setSearchMsg("Pencarian gagal. Periksa koneksi lalu coba lagi.");
    }
    setSearching(false);
  }

  function pickHit(h: SearchHit) {
    const E = eng.current;
    const lat = parseFloat(h.lat);
    const lng = parseFloat(h.lon);
    const name = h.display_name.split(",")[0].slice(0, 40);
    (E as { _addPin?: (a: number, b: number, c?: string) => void })._addPin?.(lat, lng, name);
    E.cx = mx(lng);
    E.cy = my(lat);
    E.z = Math.max(E.z, 13);
    (E as { _save?: () => void })._save?.();
    setHits([]);
    setQuery("");
    setSearchMsg("Ditambahkan: " + name);
  }

  function renamePin(id: number, name: string) {
    const E = eng.current;
    const p = E.pins.find((x) => x.id === id);
    if (p) p.name = name.slice(0, 40) || "Lokasi";
    (E as { _save?: () => void })._save?.();
    syncFromEngine();
  }
  function setPinVeh(id: number, veh: Veh) {
    const E = eng.current;
    const p = E.pins.find((x) => x.id === id);
    if (p) p.veh = veh;
    (E as { _save?: () => void })._save?.();
    syncFromEngine();
  }
  function removePin(id: number) {
    const E = eng.current;
    E.pins = E.pins.filter((x) => x.id !== id);
    (E as { _save?: () => void })._save?.();
    (E as { _updateRoute?: () => void })._updateRoute?.();
    syncFromEngine();
  }
  function clearAll() {
    const E = eng.current;
    if (!E.pins.length) return;
    setConfirmHapusSemua(true);
  }
  function doClearAll() {
    const E = eng.current;
    setConfirmHapusSemua(false);
    if (!E.pins.length) return;
    E.pins = [];
    (E as { _save?: () => void })._save?.();
    (E as { _updateRoute?: () => void })._updateRoute?.();
    syncFromEngine();
  }

  async function exportVideo() {
    const E = eng.current;
    const cv = canvasRef.current!;
    if (E.exporting) return;
    if (E.pins.length < 2) {
      alert("Taruh minimal 2 lokasi dulu.");
      return;
    }
    if (!window.MediaRecorder || !cv.captureStream) {
      alert("Browser ini belum mendukung perekaman video.");
      return;
    }
    const types = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mime = types.find((t) => {
      try {
        return MediaRecorder.isTypeSupported(t);
      } catch {
        return false;
      }
    });
    if (!mime) {
      alert("Format video tidak didukung browser ini.");
      return;
    }
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    const chunks: Blob[] = [];
    E.wasPlaying = E.playing;
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(cv.captureStream(60), { mimeType: mime, videoBitsPerSecond: 10_000_000 });
    } catch (e) {
      alert("Gagal memulai rekaman: " + (e as Error).message);
      return;
    }
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      E.exporting = false;
      E.playing = E.wasPlaying;
      setProgress(null);
      syncFromEngine();
      const blob = new Blob(chunks, { type: mime });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = "peta-animasi." + ext;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 10000);
      E.status = ext === "webm" ? "Disimpan sebagai WebM, browser ini tidak mendukung MP4" : "Video tersimpan";
      setStatusText(E.status);
    };
    E.stopRec = () => {
      E.stopRec = null;
      if (rec.state !== "inactive") rec.stop();
    };
    E.exporting = true;
    E.T = 0;
    setProgress("0%");
    rec.start(250);
  }

  function exportPNG() {
    const cv = canvasRef.current!;
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "peta.png";
    document.body.append(a);
    a.click();
    a.remove();
  }

  function savePreset() {
    const E = eng.current;
    const blob = new Blob([localStorage.getItem(LS_KEY) || JSON.stringify({ pins: E.pins })], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = "peta-preset.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 5000);
  }

  function loadPreset(file: File) {
    const E = eng.current;
    file.text().then((t) => {
      try {
        const d = JSON.parse(t);
        E.pins = (d.pins || []).map((p: Pin) => ({ ...p, veh: (p.veh || "auto") as Veh }));
        E.uid = d.uid || E.pins.length + 1;
        if (d.view) {
          E.cx = d.view.cx ?? E.cx;
          E.cy = d.view.cy ?? E.cy;
          E.z = d.view.z ?? E.z;
        }
        (E as { _save?: () => void })._save?.();
        (E as { _updateRoute?: () => void })._updateRoute?.();
        syncFromEngine();
      } catch {
        alert("File preset tidak valid.");
      }
    });
  }

  const pins = eng.current.pins;
  const ctl: React.CSSProperties = {
    border: "1px solid rgba(23,23,22,.2)",
    borderRadius: 12,
    background: "#fffdf8",
    color: "#171716",
    minHeight: 44,
    padding: "8px 12px",
    fontSize: 14,
  };

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px clamp(16px,4vw,40px)",
          borderBottom: "1px solid rgba(23,23,22,.14)",
          background: "rgba(247,244,236,.96)",
          flexWrap: "wrap",
        }}
      >
        <span className="kicker" style={{ margin: 0, marginRight: "auto" }}>
          Pembuat Peta Digital
        </span>
        <button className="btn-sticker btn-ghost" onClick={() => commit({ playing: !playing })}>
          {playing ? "Jeda" : "Putar"}
        </button>
        <button className="btn-sticker btn-primary" onClick={exportVideo} disabled={eng.current.exporting}>
          {progress ? "Merekam " + progress : "Ekspor Video"}
        </button>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px clamp(16px,4vw,40px) 48px" }}>
        <p style={{ color: "#74746d", fontSize: 14, maxWidth: 720, margin: "0 0 16px" }}>
          Klik peta untuk menaruh lokasi, seret pin untuk memindah, seret peta untuk menggeser, scroll untuk zoom. Cari
          tempat lewat kolom di bawah, lalu pilih dari daftar hasil agar tepat sasaran.
        </p>

        <div className="card" style={{ padding: 12, marginBottom: 12 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch(query);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari tempat, misal: Stasiun Bandung"
              aria-label="Cari tempat"
              style={{ ...ctl, flex: 1 }}
            />
            <button className="btn-sticker btn-ghost" type="submit" disabled={searching}>
              {searching ? "Mencari" : "Cari"}
            </button>
          </form>
          {searchMsg ? <p style={{ fontSize: 13, color: "#74746d", margin: "8px 2px 0" }}>{searchMsg}</p> : null}
          {hits.length > 0 ? (
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
              {hits.map((h) => (
                <li key={h.place_id}>
                  <button
                    type="button"
                    onClick={() => pickHit(h)}
                    style={{ ...ctl, width: "100%", textAlign: "left", cursor: "pointer", borderColor: "rgba(23,23,22,.28)" }}
                  >
                    <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>{h.display_name.split(",")[0]}</span>
                    <span style={{ display: "block", fontSize: 12, color: "#74746d" }}>{h.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="peta-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 12, alignItems: "start" }}>
          <div>
            <div
              ref={wrapRef}
              style={{
                position: "relative",
                height: "min(62vh, 560px)",
                minHeight: 380,
                borderRadius: 24,
                overflow: "hidden",
                border: "1px solid rgba(23,23,22,.16)",
                background: "#e8e4dc",
              }}
            >
              <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, touchAction: "none", cursor: "crosshair" }} />
              <div style={{ position: "absolute", right: 10, bottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <button
                  aria-label="Perbesar"
                  style={{ ...ctl, minHeight: 44, minWidth: 44, fontSize: 18 }}
                  onClick={() => {
                    const E = eng.current;
                    E.z = Math.min(19, E.z + 0.7);
                    (E as { _save?: () => void })._save?.();
                  }}
                >
                  +
                </button>
                <button
                  aria-label="Perkecil"
                  style={{ ...ctl, minHeight: 44, minWidth: 44, fontSize: 18 }}
                  onClick={() => {
                    const E = eng.current;
                    E.z = Math.max(2, E.z - 0.7);
                    (E as { _save?: () => void })._save?.();
                  }}
                >
                  -
                </button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#74746d", margin: "8px 2px 0" }}>
              {pins.length} lokasi{status ? " - " + status : ""}
            </p>
          </div>

          <aside className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700 }}>
              Kamera
              <select value={cam} onChange={(e) => commit({ cam: e.target.value as CamMode })} style={ctl}>
                <option value="follow">Ikuti kendaraan</option>
                <option value="fit">Pas di layar</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700 }}>
              Jalur
              <select value={mode} onChange={(e) => commit({ mode: e.target.value as RouteMode })} style={ctl}>
                <option value="auto">Otomatis</option>
                <option value="darat">Darat</option>
                <option value="air">Air atau udara</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700 }}>
              Kendaraan bawaan
              <select value={defaultVeh} onChange={(e) => commit({ defaultVeh: e.target.value as Veh })} style={ctl}>
                {(Object.keys(VEH_LABEL) as Veh[]).map((v) => (
                  <option key={v} value={v}>
                    {VEH_LABEL[v]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 700 }}>
              Kecepatan: {speed}x
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.5}
                value={speed}
                onChange={(e) => commit({ speed: parseFloat(e.target.value) })}
                style={{ width: "100%" }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-sticker btn-ghost" onClick={() => commit({ loop: !loop })}>
                {loop ? "Loop aktif" : "Loop mati"}
              </button>
              <button className="btn-sticker btn-ghost" onClick={() => commit({ dark: !dark })}>
                {dark ? "Siang" : "Malam"}
              </button>
              <button className="btn-sticker btn-ghost" onClick={() => fitView()}>
                Pas Layar
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-sticker btn-ghost" onClick={exportPNG}>
                Simpan PNG
              </button>
              <button className="btn-sticker btn-ghost" onClick={savePreset}>
                Simpan Preset
              </button>
              <label className="btn-sticker btn-ghost" style={{ cursor: "pointer" }}>
                Muat Preset
                <input
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadPreset(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <button className="btn-sticker btn-ghost" onClick={clearAll}>
                Hapus Semua
              </button>
            </div>

            <div>
              <button
                className="btn-sticker btn-ghost"
                onClick={() => setListOpen((v) => !v)}
                aria-expanded={listOpen}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {listOpen ? "Sembunyikan daftar" : "Tampilkan daftar (" + pins.length + ")"}
              </button>
              {listOpen ? (
                <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 8 }}>
                  {pins.length === 0 ? (
                    <li style={{ fontSize: 13, color: "#74746d" }}>Belum ada lokasi. Klik peta atau cari tempat dulu.</li>
                  ) : null}
                  {pins.map((p, i) => (
                    <li key={p.id} style={{ border: "1px solid rgba(23,23,22,.16)", borderRadius: 12, padding: 8, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span
                          style={{
                            flex: "none",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "#e85e43",
                            color: "#fffdf8",
                            fontSize: 12,
                            fontWeight: 800,
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {i + 1}
                        </span>
                        <input
                          value={p.name}
                          maxLength={40}
                          onChange={(e) => renamePin(p.id, e.target.value)}
                          aria-label={"Nama lokasi " + (i + 1)}
                          style={{ ...ctl, flex: 1, minWidth: 0, minHeight: 40, fontSize: 13 }}
                        />
                        <button aria-label={"Hapus lokasi " + (i + 1)} onClick={() => removePin(p.id)} style={{ ...ctl, minHeight: 40, minWidth: 40 }}>
                          X
                        </button>
                      </div>
                      <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#74746d" }}>
                        Kendaraan titik ini
                        <select value={p.veh} onChange={(e) => setPinVeh(p.id, e.target.value as Veh)} style={{ ...ctl, minHeight: 40, fontSize: 13 }}>
                          {(Object.keys(VEH_LABEL) as Veh[]).map((v) => (
                            <option key={v} value={v}>
                              {VEH_LABEL[v]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </aside>
        </div>
      </main>

      <style>{`@media (max-width: 900px) {
        .peta-layout { grid-template-columns: 1fr !important; }
      }`}</style>
      <ConfirmDialog
        open={confirmHapusSemua}
        title="Hapus semua lokasi?"
        message="Semua titik lokasi di peta akan dihapus dan tidak bisa dikembalikan."
        confirmLabel="Ya, hapus semua"
        onConfirm={doClearAll}
        onCancel={() => setConfirmHapusSemua(false)}
      />
    </div>
  );
}
