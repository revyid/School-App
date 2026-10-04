import { z } from "zod";

export const SCAN_COOLDOWN_SEC = 60;

export const scanSchema = z.object({
  token: z.string().trim().min(8).max(128),
});

// Tanggal kalender YYYY-MM-DD -> Date UTC tengah malam (kolom @db.Date).
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(d.getTime()) ? null : d;
}

export function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Hari ini (WIB) sebagai Date UTC tengah malam.
export function todayWib(): Date {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export const manualSchema = z.object({
  studentId: z.string().min(1).max(64),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["HADIR", "IZIN", "SAKIT", "ALPHA"]),
  note: z.string().trim().max(280).optional().nullable(),
});

export const calendarSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["LIBUR", "EFEKTIF"]),
  classId: z.string().min(1).max(64).optional().nullable(),
  note: z.string().trim().max(280).optional().nullable(),
});

export type AttStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA";

// Idempoten + cooldown: HADIR sudah ada -> duplicate (cooldown bila < cooldownSec);
// non-HADIR -> boleh timpa jadi HADIR.
export function scanDecision(
  existing: { status: AttStatus; scannedAt: Date | null } | null,
  now: Date,
  cooldownSec: number,
): { ok: true } | { ok: false; reason: "already" | "cooldown" } {
  if (!existing) return { ok: true };
  if (existing.status === "HADIR") {
    if (existing.scannedAt) {
      const age = (now.getTime() - existing.scannedAt.getTime()) / 1000;
      if (age < cooldownSec) return { ok: false, reason: "cooldown" };
    }
    return { ok: false, reason: "already" };
  }
  return { ok: true };
}

export interface AutoAlphaPick {
  students: { id: string; classId: string | null }[];
  existing: Map<string, AttStatus>;
  calendar: { kind: "LIBUR" | "EFEKTIF"; classId: string | null }[];
  approvedLeave: Set<string>;
  hasTimetable: (classId: string | null) => boolean;
}

// Daftar studentId yang harus ditandai ALPHA. Melewati: sudah ada record,
// LIBUR global/kelas, tanpa jadwal & tanpa override EFEKTIF, cuti APPROVED.
export function pickAutoAlpha(o: AutoAlphaPick): string[] {
  const globalLibur = o.calendar.some((c) => c.kind === "LIBUR" && !c.classId);
  if (globalLibur) return [];
  const liburKelas = new Set(o.calendar.filter((c) => c.kind === "LIBUR" && c.classId).map((c) => c.classId!));
  const efektifKelas = new Set(o.calendar.filter((c) => c.kind === "EFEKTIF" && c.classId).map((c) => c.classId!));
  const out: string[] = [];
  for (const s of o.students) {
    if (o.existing.has(s.id)) continue;
    if (o.approvedLeave.has(s.id)) continue;
    if (s.classId && liburKelas.has(s.classId)) continue;
    if (s.classId && efektifKelas.has(s.classId)) {
      out.push(s.id);
      continue;
    }
    if (o.hasTimetable(s.classId)) out.push(s.id);
  }
  return out;
}
