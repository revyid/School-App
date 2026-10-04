import { z } from "zod";

// ---------- Skema ----------

export const questionInputSchema = z.object({
  subjectId: z.string().min(1).max(64).optional().nullable(),
  type: z.enum(["MCQ", "SORTING"]).default("MCQ"),
  stem: z.string().trim().min(1).max(10000),
  imageName: z.string().max(255).optional().nullable(),
  // MCQ: 2-6 opsi + correctIndex. SORTING: 2-8 item + correctOrder implisit = urutan options.
  options: z.array(z.string().trim().min(1).max(2000)).min(2).max(8),
  correctIndex: z.number().int().min(0).max(7).optional().nullable(),
}).superRefine((v, ctx) => {
  if (v.type === "MCQ") {
    if (v.options.length > 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ maksimal 6 opsi", path: ["options"] });
    }
    if (v.correctIndex == null || v.correctIndex >= v.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "correctIndex wajib & dalam rentang opsi", path: ["correctIndex"] });
    }
  }
});

export const assessmentInputSchema = z.object({
  classId: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64).optional().nullable(),
  kind: z.enum(["DIAGNOSTIC", "REGULAR"]).default("REGULAR"),
  title: z.string().trim().min(1).max(200),
  instruction: z.string().trim().max(10000).optional().nullable(),
  durationMin: z.number().int().min(1).max(480).optional().nullable(),
  publishAt: z.string().datetime({ offset: true }).optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  shuffleQ: z.boolean().default(true),
  shuffleOpt: z.boolean().default(true),
  // questionIds dari bank (snapshot saat attach) ATAU buat inline. Minimal 1 soal.
  questionIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  inline: z.array(questionInputSchema).max(100).default([]),
}).superRefine((v, ctx) => {
  if (v.questionIds.length + v.inline.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "minimal 1 soal" });
  }
});

export const answerSubmitSchema = z.object({
  // answers dalam KOORDINAT ACAK (seperti ditampilkan ke siswa).
  answers: z.array(z.object({
    questionId: z.string().min(1).max(64),
    pickedIndex: z.number().int().min(0).max(7).optional().nullable(),
    pickedOrder: z.array(z.number().int().min(0).max(7)).max(8).default([]),
  })).max(100),
});

export const groupInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  studentIds: z.array(z.string().min(1).max(64)).min(1).max(50),
});

// ---------- Logika murni ----------

// PRNG deterministik (mulberry32) dari seed string — acak per attempt tapi dapat direproduksi server.
export function seedFrom(...parts: string[]): number {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  const rnd = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type QRow = {
  id: string;
  type: "MCQ" | "SORTING";
  stem: string;
  imageName: string | null;
  options: string[];
  correctIndex: number | null;
  correctOrder: number[];
  points: number;
};

// Soal versi KLIEN: tanpa kunci. options diacak bila shuffleOpt; qOrder disimpan di attempt.
export type ClientQ = {
  id: string;
  type: "MCQ" | "SORTING";
  stem: string;
  imageUrl: string | null;
  options: string[];
};

export function toClientQuestions(
  qs: QRow[],
  opts: { shuffleQ: boolean; shuffleOpt: boolean; seed: number },
): { clientQs: ClientQ[]; qOrder: string[]; optOrders: Record<string, number[]> } {
  const ordered = opts.shuffleQ ? shuffled(qs, opts.seed) : [...qs];
  const qOrder = ordered.map((q) => q.id);
  const optOrders: Record<string, number[]> = {};
  const clientQs: ClientQ[] = ordered.map((q) => {
    const idx = q.options.map((_, i) => i);
    const order = opts.shuffleOpt ? shuffled(idx, opts.seed ^ seedFrom(q.id)) : idx;
    optOrders[q.id] = order;
    return {
      id: q.id, type: q.type, stem: q.stem,
      imageUrl: q.imageName ? `/api/assess-files/${q.id}/${q.imageName}` : null,
      options: order.map((i) => q.options[i]),
    };
  });
  return { clientQs, qOrder, optOrders };
}

// Nilai jawaban klien (koordinat acak) -> koordinat asli via optOrders server. MCQ: exact. SORTING: proporsional posisi benar.
export function gradeAttempt(
  qs: QRow[],
  optOrders: Record<string, number[]>,
  answers: { questionId: string; pickedIndex?: number | null; pickedOrder?: number[] }[],
): { perQ: { questionId: string; isCorrect: boolean; points: number; pickedIndex: number | null; pickedOrder: number[] }[]; score: number; maxScore: number } {
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ansById = new Map(answers.map((a) => [a.questionId, a]));
  const perQ: { questionId: string; isCorrect: boolean; points: number; pickedIndex: number | null; pickedOrder: number[] }[] = [];
  let score = 0;
  let maxScore = 0;
  for (const q of qs) {
    maxScore += q.points;
    const a = ansById.get(q.id);
    const order = optOrders[q.id] ?? q.options.map((_, i) => i);
    if (q.type === "MCQ") {
      // pickedIndex klien -> indeks asli = order[picked].
      const picked = a?.pickedIndex == null ? null : (order[a.pickedIndex] ?? -1);
      const ok = picked != null && picked >= 0 && picked === q.correctIndex;
      const pts = ok ? q.points : 0;
      score += pts;
      perQ.push({ questionId: q.id, isCorrect: ok, points: pts, pickedIndex: picked, pickedOrder: [] });
    } else {
      // pickedOrder klien = susunan opsi-acakan menurut siswa -> petakan ke indeks asli, bandingkan dengan correctOrder.
      const raw = a?.pickedOrder ?? [];
      const mapped = raw.map((i) => order[i] ?? -1);
      const n = q.options.length;
      let correct = 0;
      for (let i = 0; i < n; i++) {
        if (mapped[i] === q.correctOrder[i]) correct++;
      }
      const ok = n > 0 && correct === n;
      const pts = n === 0 ? 0 : Math.round((q.points * correct) / n);
      score += pts;
      perQ.push({ questionId: q.id, isCorrect: ok, points: pts, pickedIndex: null, pickedOrder: mapped });
    }
  }
  return { perQ, score, maxScore };
}

// Analisis butir: tingkat kesulitan (proporsi benar) + distraktor MCQ (hitungan per opsi asli).
export function itemAnalysis(
  qs: QRow[],
  allAnswers: { questionId: string; pickedIndex: number | null; pickedOrder: number[]; isCorrect: boolean | null }[],
): { questionId: string; n: number; difficulty: number; distractors: Record<string, number> }[] {
  return qs.map((q) => {
    const rows = allAnswers.filter((a) => a.questionId === q.id);
    const n = rows.length;
    const correct = rows.filter((r) => r.isCorrect).length;
    const distractors: Record<string, number> = {};
    if (q.type === "MCQ") {
      for (let i = 0; i < q.options.length; i++) distractors[String(i)] = 0;
      for (const r of rows) {
        if (r.pickedIndex != null) distractors[String(r.pickedIndex)] = (distractors[String(r.pickedIndex)] ?? 0) + 1;
      }
    }
    return { questionId: q.id, n, difficulty: n === 0 ? 0 : correct / n, distractors };
  });
}
