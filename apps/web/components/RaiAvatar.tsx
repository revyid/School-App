"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarEngine, BODY_RADIUS, DEFAULT_PAPER, type AnimationState, type AvatarFrame, type HeadGaze } from "@/lib/grok-engine";
type AvatarMood = "idle" | "thinking" | "happy" | "concerned" | "angry" | "wary" | "confused";
interface Props { mood?: AvatarMood; size?: number; interactive?: boolean; label?: string; animate?: boolean }
const MOOD: Record<AvatarMood, { state: AnimationState; expression: string; label: string }> = {
  idle: { state: "Idle", expression: "attentive", label: "Asisten siap membantu" },
  thinking: { state: "Thinking", expression: "curious", label: "Asisten sedang berpikir" },
  happy: { state: "Idle", expression: "excited", label: "Asisten senang membantu" },
  concerned: { state: "Alert", expression: "wary", label: "Asisten menemukan kendala" },
  angry: { state: "Alert", expression: "angry", label: "Asisten mendeteksi ketidaksopanan" },
  wary: { state: "Alert", expression: "wary", label: "Asisten waspada soal keamanan" },
  confused: { state: "Idle", expression: "confused", label: "Asisten belum yakin dengan jawaban" },
};
export default function RaiAvatar({ mood = "idle", size = 58, interactive = true, label, animate = true }: Props) {
  const config = MOOD[mood];
  const engine = useMemo(() => new AvatarEngine({ state: "Idle", shape: "circle", expression: "attentive", paper: DEFAULT_PAPER, wander: 0.6, blink: true, float: true }, 420), []);
  const [frame, setFrame] = useState<AvatarFrame>(() => engine.sample(0, { expression: "attentive", gaze: { yaw: 0, pitch: 0, roll: 0 }, wander: 0.6, blink: true, float: true }));
  const target = useRef<HeadGaze>({ yaw: 0, pitch: 0, roll: 0 });
  const gaze = useRef<HeadGaze>({ yaw: 0, pitch: 0, roll: 0 });
  const lastState = useRef<AnimationState>("Idle");
  const raf = useRef<number | null>(null);
  const uid = useMemo(() => `rai-avatar-${Math.random().toString(36).slice(2, 10)}`, []);
  useEffect(() => {
    if (!interactive) return;
    const onPointer = (event: PointerEvent) => { target.current = { yaw: ((event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1) * 24, pitch: ((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1) * 18, roll: 0 }; };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, [interactive]);
  useEffect(() => { if (lastState.current !== config.state) { engine.setState(config.state, performance.now() / 1000); lastState.current = config.state; } }, [config.state, engine]);
  useEffect(() => {
    // Avatar per pesan dibuat statis (animate=false) supaya riwayat panjang
    // tidak menjalankan puluhan loop rAF.
    if (!animate) return;
    let active = true;
    const tick = (time: number) => {
      if (!active) return;
      const t = time / 1000;
      gaze.current = { yaw: gaze.current.yaw + (target.current.yaw - gaze.current.yaw) * 0.075, pitch: gaze.current.pitch + (target.current.pitch - gaze.current.pitch) * 0.075, roll: 0 };
      setFrame(engine.sample(t, { expression: config.expression, gaze: gaze.current, wander: 0.6, blink: true, float: true }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { active = false; if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [config.expression, engine, animate]);
  const gradientIds = new Map(frame.arcs.map((arc, i) => [arc.id, `${uid}-arc-${i}`]));
  const dot = (d: AvatarFrame["dots"][number], key: string) => d.d ? <path key={key} d={d.d} fill={frame.fill} opacity={d.opacity} transform={`translate(${d.x * BODY_RADIUS} ${d.y * BODY_RADIUS}) rotate(${d.rot ?? 0})`} /> : <circle key={key} cx={d.x * BODY_RADIUS} cy={d.y * BODY_RADIUS} r={d.r * BODY_RADIUS} fill={frame.fill} opacity={d.opacity} />;
  return <span className="rai-avatar"
    // dynamic: ukuran avatar dari props
    style={{ width: size, height: size }}
    role="img" aria-label={label ?? config.label} data-mood={mood} data-state={frame.state} data-shape="circle">
    <svg viewBox={frame.viewBox} width={size} height={size} aria-hidden="true" focusable="false"><defs>
      <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x={-BODY_RADIUS * 1.58} y={-BODY_RADIUS * 1.58} width={BODY_RADIUS * 3.16} height={BODY_RADIUS * 3.16}><path d={frame.path} fill="white" />{frame.eyes.map((eye, i) => <ellipse key={i} cx={eye.x} cy={eye.y} rx={eye.rx} ry={eye.ry} opacity={eye.opacity} fill="black" transform={`matrix(${eye.a} ${eye.b} ${eye.c} ${eye.d} 0 0)`} />)}</mask>
      {frame.arcs.map((arc, i) => <linearGradient key={arc.id} id={`${uid}-arc-${i}`} gradientUnits="userSpaceOnUse" x1={arc.grad.x1} y1={arc.grad.y1} x2={arc.grad.x2} y2={arc.grad.y2}>{arc.grad.stops.map((stop, j) => <stop key={j} offset={j / (arc.grad.stops.length - 1)} stopColor={stop} />)}</linearGradient>)}
    </defs>{frame.arcs.length > 0 && <g fill="none" strokeLinecap="round">{frame.arcs.map((arc) => <path key={`back-${arc.id}`} d={arc.back} stroke={`url(#${gradientIds.get(arc.id)})`} strokeWidth={arc.width} opacity={arc.opacity} />)}</g>}{frame.dotsBehind && frame.dots.map((d, i) => dot(d, `dotb-${i}`))}<path d={frame.path} fill={frame.paper} /><g mask={`url(#${uid}-mask)`}><rect x={-BODY_RADIUS * 1.58} y={-BODY_RADIUS * 1.58} width={BODY_RADIUS * 3.16} height={BODY_RADIUS * 3.16} fill={frame.fill} /></g>{!frame.dotsBehind && frame.dots.map((d, i) => dot(d, `dot-${i}`))}{frame.arcs.length > 0 && <g fill="none" strokeLinecap="round">{frame.arcs.map((arc) => <path key={`front-${arc.id}`} d={arc.front} stroke={`url(#${gradientIds.get(arc.id)})`} strokeWidth={arc.width} opacity={arc.opacity} />)}</g>}</svg>
    <style jsx global>{`.rai-avatar{display:inline-block;flex:0 0 auto;vertical-align:middle;filter:drop-shadow(0 3px 4px rgba(23,23,22,.22));animation:rai-avatar-float 4.8s ease-in-out infinite}.rai-avatar svg{display:block;width:100%;height:100%;overflow:visible}@keyframes rai-avatar-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}@media(prefers-reduced-motion:reduce){.rai-avatar{animation:none}}`}</style>
  </span>;
}
