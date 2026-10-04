import { redis } from "./redis";

export async function hit(key: string, limit: number, windowSec: number) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  const ttl = await redis.ttl(key);
  return { ok: n <= limit, retryAfter: ttl < 0 ? windowSec : ttl };
}

// Tanpa pasta (fallback gateway IP): X-Real-IP = IP gateway untuk semua klien,
// jadi batas per-IP dilonggarkan 10x; batas per-AKUN tetap ketat.
const RELAXED = process.env.TRUST_GATEWAY_IP === "1";
const IP_MIN = RELAXED ? 100 : 10;
const IP_HOUR = RELAXED ? 1000 : 100;

export async function loginRateLimit(ip: string, acct: string) {
  const r1 = await hit(`rl:login:ip:${ip}`, IP_MIN, 60);
  if (!r1.ok) return { blocked: true as const, ...r1 };
  const r2 = await hit(`rl:login:iphr:${ip}`, IP_HOUR, 3600);
  if (!r2.ok) return { blocked: true as const, ...r2 };
  const r3 = await hit(`rl:login:acct:${acct}`, 5, 300);
  if (!r3.ok) return { blocked: true as const, ...r3 };
  return { blocked: false as const, retryAfter: 0 };
}
