import argon2 from "argon2";
import { db } from "@sms/db/client";
import { getRootDb } from "@sms/db/root";
import { loginRateLimit } from "./rate-limit";
import { createSession } from "./session";

// Login SUPER_ADMIN via admin.<apex>: verifikasi lewat RPC SECURITY DEFINER
// (web app_user tak punya SELECT ke baris schoolId NULL). Rate limit ketat.
export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Audit percobaan login root: tanpa ini, brute-force akun SUPER_ADMIN tidak
// meninggalkan jejak. Akun root tidak punya sekolah, jadi tabel terpisah
// (RootAuthAttempt) — hanya app_root boleh menulis.
async function logRootAttempt(email: string, ip: string, ok: boolean) {
  try {
    const root = getRootDb();
    await root.$queryRaw`
      INSERT INTO "RootAuthAttempt" ("email", "action", "ip", "meta")
      VALUES (${email}, ${ok ? "AUTH.LOGIN_OK" : "AUTH.LOGIN_FAIL"}, ${ip}, ${JSON.stringify({ root: true })}::jsonb)`;
  } catch {
    // Audit tidak boleh menggagalkan login.
  }
}

export async function attemptSuperAdminLogin(o: { email: string; password: string; ip: string }) {
  const email = o.email.trim().toLowerCase();
  const rl = await loginRateLimit(o.ip, `sa:e:${email}`);
  if (rl.blocked) throw new AuthError(429, "Terlalu banyak percobaan, coba lagi nanti");
  const rows = await db.$queryRaw<{ id: string; password_hash: string; must_change: boolean }[]>`
    SELECT * FROM public.super_admin_cred(${email})`;
  const cred = rows[0];
  if (!cred) {
    await argon2.hash("dummy-burn");
    await logRootAttempt(email, o.ip, false);
    throw new AuthError(401, "Email atau kata sandi salah");
  }
  let ok = false;
  try {
    ok = await argon2.verify(cred.password_hash, o.password);
  } catch {
    ok = false;
  }
  if (!ok) {
    await logRootAttempt(email, o.ip, false);
    throw new AuthError(401, "Email atau kata sandi salah");
  }
  await logRootAttempt(email, o.ip, true);
  const { sid, csrf } = await createSession(cred.id, "", "admin", "SUPER_ADMIN");
  return { sid, csrf, mustChangePassword: cred.must_change, user: { id: cred.id, role: "SUPER_ADMIN" as const } };
}
