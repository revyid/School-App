import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { db } from "@sms/db/client";
import { createSession, readSession } from "../session";

let saId = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  saId = (await dbSystem.user.create({
    data: {
      schoolId: null, role: "SUPER_ADMIN", email: `root-${t}@sys.local`,
      name: "Root", passwordHash: await argon2.hash("rahasia-kuat-123"),
    },
  })).id;
});

afterAll(async () => {
  await dbSystem.user.deleteMany({ where: { id: saId } });
});

describe("RPC super_admin_cred", () => {
  it("email persis -> kredensial kembali; email lain -> kosong", async () => {
    const me = await dbSystem.user.findUnique({ where: { id: saId }, select: { email: true } });
    const rows = await db.$queryRaw<{ id: string; password_hash: string; must_change: boolean }[]>`
      SELECT * FROM public.super_admin_cred(${me!.email})`;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(saId);
    expect(await argon2.verify(rows[0].password_hash, "rahasia-kuat-123")).toBe(true);
    const none = await db.$queryRaw<{ id: string }[]>`
      SELECT * FROM public.super_admin_cred('tak-ada@sys.local')`;
    expect(none).toHaveLength(0);
  });

  it("user tenant tak terbaca via RPC (schoolId NOT NULL dikecualikan)", async () => {
    const u = await dbSystem.user.create({
      data: { schoolId: (await dbSystem.school.create({ data: { slug: `sax-${Date.now().toString(36)}`, name: "SA" } })).id, role: "ADMIN", email: `ax-${Date.now().toString(36)}@x.id`, name: "AX", passwordHash: "x" },
    });
    const full = await dbSystem.user.findUnique({ where: { id: u.id }, select: { email: true } });
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT * FROM public.super_admin_cred(${full!.email})`;
    expect(rows).toHaveLength(0);
    await dbSystem.school.deleteMany({ where: { id: (await dbSystem.user.findUnique({ where: { id: u.id }, select: { schoolId: true } }))!.schoolId! } });
  });
});

describe("RPC super_admin_active", () => {
  it("aktif=true untuk super-admin; false/kosong untuk id asing", async () => {
    const rows = await db.$queryRaw<{ active: boolean; pwd_changed: Date | null; must_change: boolean }[]>`
      SELECT * FROM public.super_admin_active(${saId})`;
    expect(rows[0]?.active).toBe(true);
    const none = await db.$queryRaw<{ active: boolean }[]>`
      SELECT * FROM public.super_admin_active('tidak-ada')`;
    expect(none).toHaveLength(0);
  });
});

describe("sesi super-admin (schoolId kosong)", () => {
  it("readSession menerima sesi sch=admin/schoolId=''", async () => {
    const { sid } = await createSession(saId, "", "admin", "SUPER_ADMIN");
    const s = await readSession(sid);
    expect(s?.userId).toBe(saId);
    expect(s?.schoolId).toBe("");
    expect(s?.sch).toBe("admin");
  });
});
