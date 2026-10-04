// Handshake Socket.io: cookie sesi opak + Origin ketat + status user.
import { Redis } from "ioredis";
import { schoolSlugFromHost } from "@sms/shared/school";

const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { lazyConnect: true, maxRetriesPerRequest: 2 });
const SESSION_TTL = 7 * 24 * 3600;

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export interface SocketCtx {
  userId: string;
  schoolId: string;
  role: string;
}

export async function authorizeSocket(o: {
  cookieHeader: string | null;
  host: string;
  origin: string | null;
  apex: string;
  sessionCookie?: string;
  resolveSchoolId: (slug: string) => Promise<string | null>;
  lookupUser: (schoolId: string, userId: string) => Promise<{
    isActive: boolean;
    role: string;
    passwordChangedAt: Date | null;
  } | null>;
}): Promise<SocketCtx> {
  const slug = schoolSlugFromHost(o.host, o.apex);
  if (!slug) throw new Error("unknown host");
  const want = `${slug}.${o.apex}`.toLowerCase();
  if (!o.origin) throw new Error("missing origin");
  let originHost = "";
  try {
    originHost = new URL(o.origin).hostname.toLowerCase();
  } catch {
    throw new Error("bad origin");
  }
  if (originHost !== want) throw new Error(`bad origin (want https://${want})`);
  const sid = parseCookies(o.cookieHeader)[o.sessionCookie ?? "__Host-session"];
  if (!sid || !/^[0-9a-f]{64}$/.test(sid)) throw new Error("no session");
  const s = await redis.hgetall(`sess:${sid}`);
  if (!s?.userId || !s?.schoolId || !s?.role || !s?.iat) throw new Error("revoked");
  const schoolId = await o.resolveSchoolId(slug);
  if (!schoolId || s.schoolId !== schoolId || s.sch !== slug) throw new Error("cross-school token");
  const user = await o.lookupUser(schoolId, s.userId);
  if (!user?.isActive) throw new Error("inactive");
  if (!user.role || user.role !== s.role) throw new Error("role mismatch");
  if (user.passwordChangedAt && Number(s.iat) < user.passwordChangedAt.getTime()) {
    throw new Error("stale session");
  }
  await redis.expire(`sess:${sid}`, SESSION_TTL);
  await redis.expire(`user-sess:${s.userId}`, SESSION_TTL);
  return { userId: s.userId, schoolId, role: s.role };
}
