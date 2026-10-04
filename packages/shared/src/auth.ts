import { z } from "zod";

export const SESSION_COOKIE = "__Host-session"; // Secure + Path=/ + tanpa Domain (browser enforce)
export const CSRF_HEADER = "x-csrf-token";
export const ROLE_HOME = { ADMIN: "/admin", GURU: "/guru", SISWA: "/siswa" } as const;
export type Role = keyof typeof ROLE_HOME;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
});
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
});
