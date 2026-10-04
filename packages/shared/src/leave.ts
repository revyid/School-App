import { z } from "zod";
import { parseDay } from "./attendance.js";

export const CAPTURE_TTL_SEC = 5 * 60; // token capture 5 menit
export const MAX_LEAVE_PHOTO = 3 * 1024 * 1024; // 3MB per foto

export const leaveInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["IZIN", "SAKIT"]),
  description: z.string().trim().min(10).max(1000),
});

export const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const consentSchema = z.object({
  studentId: z.string().min(1).max(64),
  consented: z.boolean(),
});

export const policySchema = z.object({
  text: z.string().trim().min(1).max(50000),
});

export function leaveDay(s: string): Date | null {
  return parseDay(s);
}
