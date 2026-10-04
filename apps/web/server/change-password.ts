import argon2 from "argon2";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { changePasswordSchema } from "@sms/shared/auth";
import { authorize } from "./auth-gate";
import { hit } from "./rate-limit";
import { redis } from "./redis";
import { revokeAllUserSessions } from "./session";
import { logAuth } from "./audit";

export async function doChangePassword(input: {
  host: string;
  token?: string;
  origin?: string | null;
  referer?: string | null;
  csrf?: string | null;
  oldPassword: unknown;
  newPassword: unknown;
}) {
  const parsed = changePasswordSchema.safeParse({ oldPassword: input.oldPassword, newPassword: input.newPassword });
  if (!parsed.success) return { ok: false as const, status: 400, error: "password baru minimal 8 karakter" };
  const a = await authorize({
    host: input.host,
    token: input.token,
    pathname: "/api/auth/change-password",
    mutation: true,
    origin: input.origin,
    referer: input.referer,
    csrf: input.csrf,
  });
  if (!a.ok) return a;
  const rl = await hit(`rl:pw:uid:${a.userId}`, 5, 900);
  if (!rl.ok) return { ok: false as const, status: 429, error: "Terlalu banyak percobaan, coba lagi nanti" };
  const u = await runAsSchool(db, a.school.id, (tx) => tx.user.findUnique({ where: { id: a.userId } }));
  if (!u) return { ok: false as const, status: 401, error: "unauthorized" };
  const oldOk = await argon2.verify(u.passwordHash, parsed.data.oldPassword).catch(() => false);
  if (!oldOk) return { ok: false as const, status: 401, error: "kata sandi lama salah" };
  const now = new Date();
  const hash = await argon2.hash(parsed.data.newPassword, { type: argon2.argon2id });
  await runAsSchool(
    db,
    a.school.id,
    (tx) =>
      tx.user.update({
        where: { id: a.userId },
        data: { passwordHash: hash, passwordChangedAt: now, mustChangePassword: false },
      }),
    { timeout: 15_000 },
  );
  // Sesi saat ini harus selamat: naikkan iat MELEWATI passwordChangedAt
  // SEBELUM mencabut sesi lain (cek authorize: iat < passwordChangedAt).
  await redis.hset(`sess:${a.sid}`, "iat", String(Date.now()));
  await revokeAllUserSessions(a.userId, a.sid);
  await logAuth(a.school.id, "AUTH.PASSWORD_CHANGE", { actorId: a.userId });
  return { ok: true as const };
}
