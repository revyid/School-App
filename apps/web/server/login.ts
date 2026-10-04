import argon2 from "argon2";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { loginRateLimit } from "./rate-limit";
import { createSession } from "./session";
import { logAuth } from "./audit";

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const UNIFORM_401 = "Email/NISN atau kata sandi salah";

export async function attemptLogin(o: {
  schoolId: string;
  schoolSlug: string;
  identifier: string;
  password: string;
  ip: string;
}) {
  const id = o.identifier.trim();
  const isEmail = id.includes("@");
  const key = `${o.schoolId}:${isEmail ? "e" : "n"}:${id.toLowerCase()}`;
  const rl = await loginRateLimit(o.ip, key);
  // SENGAJA tanpa audit saat diblokir rate limit (mencegah banjir baris).
  if (rl.blocked) throw new AuthError(429, "Terlalu banyak percobaan, coba lagi nanti");
  const user = await runAsSchool(db, o.schoolId, (tx) =>
    tx.user.findFirst({
      where: isEmail
        ? { schoolId: o.schoolId, email: { equals: id, mode: "insensitive" } }
        : { schoolId: o.schoolId, nisn: id },
    }));
  if (!user || !user.isActive) {
    await argon2.hash("dummy-burn");
    await logAuth(o.schoolId, "AUTH.LOGIN_FAIL", { ip: o.ip, meta: { t: isEmail ? "e" : "n" } });
    throw new AuthError(401, UNIFORM_401);
  }
  let ok = false;
  try {
    ok = await argon2.verify(user.passwordHash, o.password);
  } catch {
    ok = false;
  }
  if (!ok) {
    await logAuth(o.schoolId, "AUTH.LOGIN_FAIL", { actorId: user.id, ip: o.ip, meta: { t: isEmail ? "e" : "n" } });
    throw new AuthError(401, UNIFORM_401);
  }
  const { sid, csrf } = await createSession(user.id, o.schoolId, o.schoolSlug, user.role);
  await logAuth(o.schoolId, "AUTH.LOGIN_OK", { actorId: user.id, ip: o.ip });
  return {
    sid,
    csrf,
    mustChangePassword: user.mustChangePassword,
    user: { id: user.id, name: user.name, role: user.role },
  };
}
