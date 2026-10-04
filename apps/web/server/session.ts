import { randomBytes, timingSafeEqual } from "node:crypto";
import { redis } from "./redis";
import { SESSION_COOKIE } from "@sms/shared/auth";

const SESSION_TTL = 7 * 24 * 3600; // 7 hari, sliding

export interface SessRec {
  userId: string;
  schoolId: string;
  sch: string;
  role: string;
  csrf: string;
  iat: string;
}

export const cookieHeader = (sid: string, maxAge = SESSION_TTL) =>
  `${SESSION_COOKIE}=${sid}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
export const clearCookieHeader = () =>
  `${SESSION_COOKIE}=deleted; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;

export async function createSession(userId: string, schoolId: string, schoolSlug: string, role: string) {
  const sid = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  const iat = String(Date.now());
  await redis.hset(`sess:${sid}`, { userId, schoolId, sch: schoolSlug, role, csrf, iat });
  await redis.expire(`sess:${sid}`, SESSION_TTL);
  await redis.sadd(`user-sess:${userId}`, sid);
  await redis.expire(`user-sess:${userId}`, SESSION_TTL);
  return { sid, csrf };
}

export async function readSession(sid: string): Promise<SessRec | null> {
  if (!sid || !/^[0-9a-f]{64}$/.test(sid)) return null;
  const s = await redis.hgetall(`sess:${sid}`);
  if (!s?.userId || !s?.schoolId || !s?.sch || !s?.csrf || !s?.iat) return null;
  await redis.expire(`sess:${sid}`, SESSION_TTL);
  await redis.expire(`user-sess:${s.userId}`, SESSION_TTL);
  return s as unknown as SessRec;
}

export async function revokeSession(sid: string, userId: string) {
  await redis.del(`sess:${sid}`);
  await redis.srem(`user-sess:${userId}`, sid);
}

export async function revokeAllUserSessions(userId: string, exceptSid?: string) {
  const sids = await redis.smembers(`user-sess:${userId}`);
  for (const sid of sids) {
    if (sid === exceptSid) continue;
    await redis.del(`sess:${sid}`);
    await redis.srem(`user-sess:${userId}`, sid);
  }
}

export function csrfOk(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
