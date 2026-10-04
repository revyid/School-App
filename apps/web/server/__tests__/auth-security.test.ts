import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import argon2 from "argon2";
import { db } from "@sms/db/client";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { attemptLogin } from "../login.js";
import { authorize, requireRole } from "../auth-gate.js";
import { doChangePassword } from "../change-password.js";
import { loginRateLimit } from "../rate-limit.js";
import { redis } from "../redis.js";

const APEX = "domainmu.id";
const PW="***";
let A = { id: "", slug: "" };
let B = { id: "", slug: "" };
const createdUserIds: string[] = [];
let n = 0;
let ipN = 50;
const ip = () => `127.0.0.${ipN++}`;
const tag = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

async function makeUser(schoolId: string, role: "ADMIN" | "GURU" | "SISWA", opts?: { must?: boolean }) {
  const t = tag();
  const u = await dbSystem.user.create({
    data: {
      schoolId,
      role,
      email: `u-${t}@t.id`,
      nisn: `9${t}`.slice(0, 12),
      name: `U ${t}`,
      passwordHash: await argon2.hash(PW, { type: argon2.argon2id }),
      mustChangePassword: opts?.must ?? false,
    },
  });
  createdUserIds.push(u.id);
  return u;
}

beforeAll(async () => {
  await redis.connect().catch(() => {});
  const t = Date.now().toString(36);
  A = { id: (await dbSystem.school.create({ data: { slug: `ta-${t}`, name: "TA" } })).id, slug: `ta-${t}` };
  B = { id: (await dbSystem.school.create({ data: { slug: `tb-${t}`, name: "TB" } })).id, slug: `tb-${t}` };
});
afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: { in: [A.id, B.id] } } });
  await redis.quit();
});
afterEach(async () => {
  for (const k of await redis.keys("rl:login:*")) await redis.del(k);
  for (const k of await redis.keys("rl:pw:*")) await redis.del(k);
  for (const uid of createdUserIds.splice(0)) {
    const sids = await redis.smembers(`user-sess:${uid}`);
    for (const sid of sids) await redis.del(`sess:${sid}`);
    await redis.del(`user-sess:${uid}`);
  }
});

describe("auth part B", () => {
  it("login lintas sekolah ditolak seragam", async () => {
    const u = await makeUser(A.id, "SISWA");
    await expect(
      attemptLogin({ schoolId: B.id, schoolSlug: B.slug, identifier: u.nisn!, password: PW, ip: ip() }),
    ).rejects.toMatchObject({ status: 401, message: "Email/NISN atau kata sandi salah" });
    await expect(
      attemptLogin({ schoolId: B.id, schoolSlug: B.slug, identifier: u.email!, password: PW, ip: ip() }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("sesi sekolah A tidak berlaku di subdomain B", async () => {
    const u = await makeUser(A.id, "SISWA");
    const ok = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    expect((await authorize({ host: `${B.slug}.${APEX}`, token: ok.sid, pathname: "/" })).ok).toBe(false);
    expect((await authorize({ host: `${A.slug}.${APEX}`, token: ok.sid, pathname: "/" })).ok).toBe(true);
  });

  it("rate limit memblokir setelah ambang", async () => {
    const acct = `t-${tag()}`;
    const addr = ip();
    for (let i = 0; i < 5; i++) await loginRateLimit(addr, acct);
    expect((await loginRateLimit(addr, acct)).blocked).toBe(true);
  });

  it("mutasi tanpa/beda CSRF atau Origin asing ditolak", async () => {
    const u = await makeUser(A.id, "GURU");
    const ok = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    const base = { host: `${A.slug}.${APEX}`, token: ok.sid, pathname: "/guru", mutation: true as const, origin: `https://${A.slug}.${APEX}` };
    expect((await authorize({ ...base, csrf: null })).ok).toBe(false);
    expect((await authorize({ ...base, csrf: "salah" })).ok).toBe(false);
    expect((await authorize({ ...base, csrf: ok.csrf, origin: "https://evil.com", referer: null })).ok).toBe(false);
    expect((await authorize({ ...base, csrf: ok.csrf })).ok).toBe(true);
  });

  it("ganti password via logic yang sama: sesi lama mati, sesi kini hidup", async () => {
    const u = await makeUser(A.id, "SISWA");
    const s1 = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    const s2 = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    const host = `${A.slug}.${APEX}`;
    const r = await doChangePassword({
      host,
      token: s2.sid,
      origin: `https://${A.slug}.${APEX}`,
      referer: null,
      csrf: s2.csrf,
      oldPassword: PW,
      newPassword: "baru-12345",
    });
    expect(r).toMatchObject({ ok: true });
    expect((await authorize({ host, token: s1.sid, pathname: "/" })).ok).toBe(false);
    expect((await authorize({ host, token: s2.sid, pathname: "/" })).ok).toBe(true);
    const again = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: "baru-12345", ip: ip() });
    expect(again.user.id).toBe(u.id);
  });

  it("requireRole menolak role salah", async () => {
    const g = await makeUser(A.id, "GURU");
    const login = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: g.nisn!, password: PW, ip: ip() });
    const host = `${A.slug}.${APEX}`;
    expect((await requireRole({ host, token: login.sid, pathname: "/admin", roles: ["ADMIN"] })).ok).toBe(false);
    expect((await requireRole({ host, token: login.sid, pathname: "/guru", roles: ["GURU"] })).ok).toBe(true);
  });

  it("mustChangePassword: diblokir kecuali allow-list, /change-password lolos", async () => {
    const u = await makeUser(A.id, "SISWA", { must: true });
    const login = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    const host = `${A.slug}.${APEX}`;
    expect(await authorize({ host, token: login.sid, pathname: "/siswa" })).toMatchObject({ ok: false, error: "must-change-password" });
    expect((await authorize({ host, token: login.sid, pathname: "/change-password" })).ok).toBe(true);
    expect((await authorize({ host, token: login.sid, pathname: "/api/auth/me" })).ok).toBe(true);
    expect((await authorize({ host, token: login.sid, pathname: "/api/auth/logout" })).ok).toBe(true);
  });

  it("user mustChangePassword bisa membuka /change-password (tanpa loop)", async () => {
    const u = await makeUser(A.id, "SISWA", { must: true });
    const login = await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: PW, ip: ip() });
    // Halaman change-password memakai pathname allow-list -> authorize lolos,
    // lalu requirePage tidak redirect (pathname === /change-password).
    const { requirePage } = await import("../../app/lib/require-page.js");
    const r = await requirePage({ host: `${A.slug}.${APEX}`, token: login.sid, pathname: "/change-password" });
    expect(r.ok).toBe(true);
  });

  it("login gagal tercatat di audit", async () => {
    const u = await makeUser(A.id, "SISWA");
    await attemptLogin({ schoolId: A.id, schoolSlug: A.slug, identifier: u.nisn!, password: "salah", ip: ip() }).catch(() => {});
    const rows = await runAsSchool(db, A.id, (tx) =>
      tx.auditLog.findMany({ where: { action: "AUTH.LOGIN_FAIL" }, take: 1, orderBy: { createdAt: "desc" } }));
    expect(rows.length).toBe(1);
  });
});
