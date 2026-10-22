import { z } from "zod";

// Nama cookie + flag Secure mengikuti environment secara otomatis:
// - `next dev` (NODE_ENV=development, HTTP tanpa TLS): cookie biasa tanpa Secure
//   supaya browser mau menyimpan di http://*.localtest.me.
// - prod (NODE_ENV=production, di belakang nginx TLS): __Host-session + Secure.
// Override manual via LACAKEDU_COOKIE_NAME / LACAKEDU_COOKIE_SECURE bila perlu.
// Nama lama SMS_COOKIE_* tetap dibaca sebagai fallback agar env server lama tidak langsung mati.
export const SESSION_COOKIE =
  (process.env.LACAKEDU_COOKIE_NAME ?? process.env.SMS_COOKIE_NAME) ??
  (process.env.NODE_ENV === "development" ? "lacakedu-session-dev" : "__Host-session");
const secureEnv = process.env.LACAKEDU_COOKIE_SECURE ?? process.env.SMS_COOKIE_SECURE;
export const COOKIE_SECURE =
  secureEnv != null
    ? secureEnv === "1"
    : process.env.NODE_ENV !== "development";
export const CSRF_HEADER = "x-csrf-token";
export const ROLE_HOME = { ADMIN: "/admin", GURU: "/guru", SISWA: "/siswa" } as const;
export type Role = keyof typeof ROLE_HOME | "SUPER_ADMIN";

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
});
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});
