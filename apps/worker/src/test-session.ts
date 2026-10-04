// Helper TEST-ONLY worker: tulis sess:<sid> langsung ke Redis.
import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";

const SESSION_TTL = 7 * 24 * 3600;

export async function createTestSession(
  redis: Redis,
  o: { userId: string; schoolId: string; sch: string; role: string },
) {
  const sid = randomBytes(32).toString("hex");
  const csrf = randomBytes(32).toString("hex");
  const iat = String(Date.now());
  await redis.hset(`sess:${sid}`, { userId: o.userId, schoolId: o.schoolId, sch: o.sch, role: o.role, csrf, iat });
  await redis.expire(`sess:${sid}`, SESSION_TTL);
  await redis.sadd(`user-sess:${o.userId}`, sid);
  await redis.expire(`user-sess:${o.userId}`, SESSION_TTL);
  return { sid, csrf };
}
