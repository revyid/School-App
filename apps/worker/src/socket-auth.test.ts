import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { authorizeSocket, parseCookies } from "./socket-auth.js";
import { createTestSession } from "./test-session.js";

const APEX = "domainmu.id";
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { lazyConnect: true, maxRetriesPerRequest: 2 });
let school = { id: "", slug: "" };
let userId = "";

beforeAll(async () => {
  await redis.connect().catch(() => {});
  const t = Date.now().toString(36);
  school = { id: (await dbSystem.school.create({ data: { slug: `ws-${t}`, name: "WS" } })).id, slug: `ws-${t}` };
  userId = (await dbSystem.user.create({
    data: { schoolId: school.id, role: "GURU", email: `ws-${t}@t.id`, nisn: `8${t}`.slice(0, 10), name: "WS", passwordHash: "x" },
  })).id;
});
afterAll(async () => {
  const sids = await redis.smembers(`user-sess:${userId}`);
  for (const sid of sids) await redis.del(`sess:${sid}`);
  await redis.del(`user-sess:${userId}`);
  await dbSystem.school.deleteMany({ where: { id: school.id } });
  await redis.quit();
});

const resolveSchoolId = (slug: string) =>
  db.school.findFirst({ where: { slug } }).then((s) => s?.id ?? null);
const lookupUser = (schoolId: string, uid: string) =>
  runAsSchool(db, schoolId, (tx) =>
    tx.user.findUnique({ where: { id: uid }, select: { isActive: true, role: true, passwordChangedAt: true } }));

describe("socket handshake", () => {
  it("parseCookies mem-parse tanpa regex", () => {
    expect(parseCookies("__Host-session=abc; a=1")).toMatchObject({ "__Host-session": "abc" });
    expect(parseCookies(null)).toEqual({});
  });

  it("happy path lolos; Origin asing dan lintas-sekolah ditolak", async () => {
    const { sid } = await createTestSession(redis, { userId, schoolId: school.id, sch: school.slug, role: "GURU" });
    const base = { cookieHeader: `__Host-session=${sid}`, host: `${school.slug}.${APEX}`, apex: APEX, resolveSchoolId, lookupUser };
    const ctx = await authorizeSocket({ ...base, origin: `https://${school.slug}.${APEX}` });
    expect(ctx).toMatchObject({ userId, schoolId: school.id, role: "GURU" });
    await expect(authorizeSocket({ ...base, origin: "https://evil.com" })).rejects.toThrow();
    await expect(authorizeSocket({ ...base, host: `lain.${APEX}`, origin: `https://lain.${APEX}` })).rejects.toThrow();
  });
});
