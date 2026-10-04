import { z } from "zod";

export const taskInputSchema = z.object({
  classId: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64).optional().nullable(),
  title: z.string().trim().min(1).max(200),
  instruction: z.string().trim().min(1).max(20000),
  type: z.enum(["UPLOAD", "DIAGNOSTIC", "REGULAR"]).default("REGULAR"),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  publishAt: z.string().datetime({ offset: true }).optional().nullable(),
  allowLate: z.boolean().default(false),
  isGroup: z.boolean().default(false),
});

export const taskPatchSchema = taskInputSchema.partial();

export const materialSchema = z.object({
  kind: z.enum(["TEXT", "FILE", "IMAGE"]),
  text: z.string().trim().max(20000).optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  mime: z.string().max(128).optional().nullable(),
  size: z.number().int().nonnegative().max(50 * 1024 * 1024).optional().nullable(),
});

export const submitSchema = z.object({
  text: z.string().trim().max(20000).optional().nullable(),
  link: z.string().trim().url().max(2048).optional().nullable(),
});

export const gradeSchema = z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string().trim().max(2000).optional().nullable(),
});

export type TaskRow = {
  publishAt: Date;
  deadline: Date | null;
  allowLate: boolean;
};

// Visibilitas siswa: publishAt sudah lewat. Guru/admin selalu bisa lihat (untuk kelola).
export function isVisibleToStudent(t: TaskRow, now: Date): boolean {
  return t.publishAt.getTime() <= now.getTime();
}

// Status pengumpulan siswa: BELUM | SUDAH | TERLAMBAT | TUTUP (deadline lewat + tak boleh late).
export function submitState(
  t: TaskRow,
  submittedAt: Date | null,
  now: Date,
): "BELUM" | "SUDAH" | "TERLAMBAT" | "TUTUP" {
  if (submittedAt) {
    if (t.deadline && submittedAt.getTime() > t.deadline.getTime()) return "TERLAMBAT";
    return "SUDAH";
  }
  if (t.deadline && now.getTime() > t.deadline.getTime() && !t.allowLate) return "TUTUP";
  return "BELUM";
}

// Apakah pengiriman masih diterima server (tolak bila TUTUP).
export function canSubmit(t: TaskRow, now: Date): boolean {
  return submitState(t, null, now) !== "TUTUP";
}

export function isLateSubmit(t: TaskRow, at: Date): boolean {
  return !!t.deadline && at.getTime() > t.deadline.getTime();
}
