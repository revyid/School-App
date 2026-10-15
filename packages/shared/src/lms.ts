import { z } from "zod";

// T2: skema tugas v2 — status DRAFT/PUBLISHED, kategori unggahan, kelompok min/max.
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  instruction: z.string().trim().max(10000).optional().nullable(),
  required: z.boolean().default(false),
  accept: z.array(z.enum(["PDF", "IMAGE", "VIDEO", "DOC"])).min(1).max(4),
  position: z.number().int().min(0).max(50).default(0),
});

export const classTargetInputSchema = z.object({
  classId: z.string().min(1).max(64),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  deadline: z.string().datetime({ offset: true }).optional().nullable(),
  publishAt: z.string().datetime({ offset: true }).optional().nullable(),
  allowLate: z.boolean().default(false),
});

export const taskInputSchema = z
  .object({
    classId: z.string().min(1).max(64),
    subjectId: z.string().min(1).max(64).optional().nullable(),
    title: z.string().trim().min(1).max(200),
    instruction: z.string().trim().min(1).max(20000),
    type: z.enum(["UPLOAD", "DIAGNOSTIC", "REGULAR", "KUIS", "PROYEK", "LATIHAN"]).default("REGULAR"),
    status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
    deadline: z.string().datetime({ offset: true }).optional().nullable(),
    publishAt: z.string().datetime({ offset: true }).optional().nullable(),
    allowLate: z.boolean().default(false),
    isGroup: z.boolean().default(false),
    groupMin: z.number().int().min(2).max(10).default(2),
    groupMax: z.number().int().min(2).max(10).default(5),
    categories: z.array(categoryInputSchema).max(10).optional(),
    // FASE 3 shared: tugaskan ke N kelas sekaligus (kompat: classId tunggal bila kosong).
    classTargets: z.array(classTargetInputSchema).max(20).optional(),
  })
  .refine((d) => d.groupMin <= d.groupMax, { message: "groupMin harus ≤ groupMax" });

export const taskTargetPatchSchema = z.object({
  classId: z.string().min(1).max(64),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  publishAt: z.string().datetime({ offset: true }).nullable().optional(),
  allowLate: z.boolean().optional(),
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    instruction: z.string().trim().min(1).max(20000).optional(),
    type: z.enum(["UPLOAD", "DIAGNOSTIC", "REGULAR", "KUIS", "PROYEK", "LATIHAN"]).optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
    deadline: z.string().datetime({ offset: true }).nullable().optional(),
    publishAt: z.string().datetime({ offset: true }).nullable().optional(),
    allowLate: z.boolean().optional(),
    isGroup: z.boolean().optional(),
    groupMin: z.number().int().min(2).max(10).optional(),
    groupMax: z.number().int().min(2).max(10).optional(),
    subjectId: z.string().min(1).max(64).nullable().optional(),
  })
  .refine((d) => d.groupMin === undefined || d.groupMax === undefined || d.groupMin <= d.groupMax, {
    message: "groupMin harus ≤ groupMax",
  });

export const materialSchema = z.object({
  kind: z.enum(["TEXT", "FILE", "IMAGE", "VIDEO"]),
  text: z.string().trim().max(20000).optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  mime: z.string().max(128).optional().nullable(),
  size: z.number().int().nonnegative().max(50 * 1024 * 1024).optional().nullable(),
  isMain: z.boolean().default(false),
  isExample: z.boolean().default(false),
  categoryId: z.string().max(64).optional().nullable(),
});

export const submitSchema = z.object({
  text: z.string().trim().max(20000).optional().nullable(),
  link: z.string().trim().url().max(2048).optional().nullable(),
});

export const gradeBulkSchema = z.object({
  grades: z
    .array(
      z.object({
        submissionId: z.string().min(1).max(64),
        score: z.number().int().min(0).max(100),
        feedback: z.string().trim().max(2000).optional().nullable(),
        applyToMembers: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(200),
});

// T7: nudge v2 — per siswa + tahap.
export const nudgeSchema = z.object({
  studentIds: z.array(z.string().min(1).max(64)).max(200).optional(),
  stage: z.enum(["reminder", "deadline", "overdue", "thanks"]),
  inapp: z.boolean().default(true),
  wa: z.boolean().default(false),
});

// T6: kelompok — siswa membuat/mengubah.
export const groupCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  memberIds: z.array(z.string().min(1).max(64)).max(9).default([]),
});
export const groupPatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  addMemberIds: z.array(z.string().min(1).max(64)).max(9).optional(),
  removeMemberIds: z.array(z.string().min(1).max(64)).max(9).optional(),
});

export type TaskRow = {
  publishAt: Date;
  deadline: Date | null;
  allowLate: boolean;
};

// Visibilitas siswa: PUBLISHED + publishAt sudah lewat. Guru/admin selalu bisa lihat (untuk kelola).
export function isVisibleToStudent(
  t: TaskRow & { status?: string },
  now: Date,
): boolean {
  if (t.status && t.status !== "PUBLISHED") return false;
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

// U6: label manusia — tidak ada enum mentah di layar.
export const TASK_TYPE_LABEL: Record<string, string> = {
  REGULAR: "Tugas biasa",
  KUIS: "Kuis",
  PROYEK: "Proyek",
  LATIHAN: "Latihan",
  UPLOAD: "Tugas unggahan",
  DIAGNOSTIC: "Diagnostik",
};
export const TASK_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};
export const SUBMIT_STATE_LABEL: Record<string, string> = {
  BELUM: "Belum dikumpulkan",
  SUDAH: "Sudah dikumpulkan",
  TERLAMBAT: "Terlambat",
  TUTUP: "Ditutup",
};
export const UPLOAD_ACCEPT_LABEL: Record<string, string> = {
  PDF: "PDF",
  IMAGE: "Gambar",
  VIDEO: "Video",
  DOC: "Dokumen",
};
