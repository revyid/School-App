import { z } from "zod";

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const classSchema = z.object({
  name: z.string().trim().min(1).max(64),
  gradeLevel: z.string().trim().max(32).optional().nullable(),
  homeroomTeacherId: z.string().min(1).max(64).optional().nullable(),
});

export const subjectSchema = z.object({
  code: z.string().trim().max(32).optional().nullable(),
  name: z.string().trim().min(1).max(128),
});

const timetableSlotBase = z.object({
  classId: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64).optional().nullable(),
  subjectName: z.string().trim().max(128).optional().default(""),
  teacherId: z.string().min(1).max(64).optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(HHMM_RE, "format jam HH:MM"),
  endTime: z.string().regex(HHMM_RE, "format jam HH:MM"),
});

export const timetableSlotSchema = timetableSlotBase.refine(
  (v) => v.endTime > v.startTime,
  { message: "jam selesai harus setelah jam mulai" },
);

export const timetableSlotInputSchema = timetableSlotBase
  .omit({ classId: true })
  .refine((v) => v.endTime > v.startTime, { message: "jam selesai harus setelah jam mulai" });

export const expRulesSchema = z.object({
  submitTepat: z.number().int().min(0).max(1000).default(10),
  submitTerlambat: z.number().int().min(0).max(1000).default(3),
  hadirHarian: z.number().int().min(0).max(1000).default(5),
  streakBonus: z.number().int().min(0).max(10000).default(20),
}).strict();

export const settingsSchema = z.object({
  portalName: z.string().trim().max(128).optional().default(""),
  startTime: z.string().regex(HHMM_RE).optional().default("07:00"),
  cutoffTime: z.string().regex(HHMM_RE).optional().default("07:30"),
  waDailyCap: z.number().int().min(1).max(10000).optional().default(200),
  waPerMinuteCap: z.number().int().min(1).max(600).optional().default(10),
  ctaGtkUrl: z.string().trim().max(512).optional().nullable(),
  ctaMuridUrl: z.string().trim().max(512).optional().nullable(),
  studentRetentionDays: z.number().int().min(7).max(3650).optional().default(90),
  photoRetentionDays: z.number().int().min(1).max(3650).optional().default(30),
  defaultPasswordMode: z.enum(["random", "nisn"]).optional().default("random"),
  // Template ucapan TTS scanner absensi (variabel: {{name}}, {{class}}).
  ttsPhrase: z.string().trim().min(1).max(200).optional().default("{{name}} sudah hadir"),
  ttsPhraseDup: z.string().trim().min(1).max(200).optional().default("{{name}} sudah di catat"),
  expRules: expRulesSchema.optional().nullable(),
});

export const teacherCreateSchema = z.object({
  email: z.string().trim().email().max(128),
  name: z.string().trim().min(1).max(128),
  nisn: z.string().trim().max(32).optional().nullable(),
  homeroomClassId: z.string().min(1).max(64).optional().nullable(),
  subject: z.string().trim().max(128).optional().nullable(),
  subjectClassId: z.string().min(1).max(64).optional().nullable(),
});

export const studentCreateSchema = z.object({
  name: z.string().trim().min(1).max(128),
  nisn: z.string().trim().min(1).max(32),
  classId: z.string().min(1).max(64).optional().nullable(),
  parentPhone: z.string().trim().max(32).optional().nullable(),
  gender: z.enum(["L", "P"]).optional().nullable(),
});

export const teacherPatchSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  email: z.string().trim().email().max(128).optional(),
  isActive: z.boolean().optional(),
  homeroomClassId: z.string().max(64).optional().nullable(),
});

export const studentPatchSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  classId: z.string().min(1).max(64).optional().nullable(),
  parentPhone: z.string().trim().max(32).optional().nullable(),
  gender: z.enum(["L", "P"]).optional().nullable(),
  birthDate: z.string().max(32).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const profilePatchSchema = z.object({
  bio: z.string().trim().max(500).optional().nullable(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(128).optional().default(""),
});

export type Pagination = z.infer<typeof paginationSchema>;

// Normalisasi nomor HP Indonesia ke format 62... (pure, dipakai worker + web).
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/[^\d]/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("62")) d = d;
  else if (d.startsWith("8")) d = "62" + d;
  else return null;
  if (d.length < 10 || d.length > 15) return null;
  return d;
}

// Normalisasi kolom JK import -> "L" | "P" | null.
export function normalizeGender(raw: string | null | undefined): "L" | "P" | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  if (["l", "laki", "laki-laki", "lakilaki", "male", "m"].includes(v)) return "L";
  if (["p", "perempuan", "female", "f"].includes(v)) return "P";
  return null;
}

// Parse tanggal lahir fleksibel (Date Excel / ISO / dd/mm/yyyy) -> Date | null.
export function parseBirthDate(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
  if (typeof raw === "number" && raw > 20000 && raw < 80000) {
    const base = Date.UTC(1899, 11, 30);
    return new Date(base + raw * 86400000);
  }
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export interface ImportRowInput {
  Nama?: unknown;
  JK?: unknown;
  NISN?: unknown;
  "Tgl Lahir"?: unknown;
  Kelas?: unknown;
  "No Ortu"?: unknown;
}

export interface ImportRowOk {
  ok: true;
  name: string;
  gender: "L" | "P" | null;
  nisn: string;
  birthDate: Date | null;
  className: string;
  parentPhone: string | null;
}

export interface ImportRowErr {
  ok: false;
  rowNumber: number;
  errors: string[];
  raw: Record<string, unknown>;
}

// Validasi satu baris import (pure, dipakai worker; diuji unit).
export function validateImportRow(input: ImportRowInput, rowNumber: number): ImportRowOk | ImportRowErr {
  const errors: string[] = [];
  const name = String(input.Nama ?? "").trim();
  if (!name) errors.push("Nama kosong");
  if (name.length > 128) errors.push("Nama > 128 karakter");
  const nisn = String(input.NISN ?? "").trim().replace(/\s+/g, "");
  if (!nisn) errors.push("NISN kosong");
  else if (!/^\d{4,20}$/.test(nisn)) errors.push("NISN harus 4-20 digit angka");
  const className = String(input.Kelas ?? "").trim();
  if (!className) errors.push("Kelas kosong");
  if (className.length > 64) errors.push("Kelas > 64 karakter");
  const gender = normalizeGender(typeof input.JK === "string" ? input.JK : input.JK == null ? null : String(input.JK));
  if (input.JK != null && String(input.JK).trim() !== "" && !gender) errors.push("JK tidak dikenal (isi L/P)");
  const birthDate = parseBirthDate(input["Tgl Lahir"]);
  if (input["Tgl Lahir"] != null && String(input["Tgl Lahir"]).trim() !== "" && !birthDate) {
    errors.push("Tgl Lahir tidak valid");
  }
  const phoneRaw = input["No Ortu"] == null ? null : String(input["No Ortu"]).trim();
  const parentPhone = normalizePhone(phoneRaw);
  if (phoneRaw && !parentPhone) errors.push("No Ortu tidak valid");
  if (errors.length > 0) {
    return { ok: false, rowNumber, errors, raw: input as Record<string, unknown> };
  }
  return { ok: true, name, gender, nisn, birthDate, className, parentPhone };
}
