import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../client.js";
import { runAsSchool } from "../tenant.js";
import { dbSystemTest } from "../test-utils.js"; // TEST-ONLY

const RLS_TABLES = ["User", "Class", "TeacherClass", "StudentProfile", "AuditLog", "School"];
// Aturan: setiap tabel tenant BARU wajib ditambah di RLS_TABLES + satu blok it di bawah.

let A = "", B = "";
const BIDS: Record<string, string> = {};
let seq = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type Tx = Parameters<Parameters<typeof runAsSchool>[2]>[0];

beforeAll(async () => {
  // GUARD: tes ini HARUS jalan sebagai app_user (bukan superuser/bypassrls).
  // Kalau koneksi punya hak lewat RLS, semua assertion di bawah tak berarti.
  const rows = await db.$queryRaw<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT current_user, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
  const me = rows[0];
  if (!me || me.current_user !== "app_user" || me.rolsuper || me.rolbypassrls) {
    throw new Error(
      `tenant-isolation.test.ts WAJIB jalan sebagai app_user tanpa BYPASSRLS; ` +
      `dapat current_user=${me?.current_user} rolsuper=${me?.rolsuper} rolbypassrls=${me?.rolbypassrls}. ` +
      `Set DATABASE_URL ke role app_user.`,
    );
  }
  const t = Date.now().toString(36);
  A = (await dbSystemTest.school.create({ data: { slug: `ia-${t}`, name: "A" } })).id;
  B = (await dbSystemTest.school.create({ data: { slug: `ib-${t}`, name: "B" } })).id;
  BIDS.guru = (await dbSystemTest.user.create({ data: { schoolId: B, role: "GURU", email: `${uniq("g")}@t.id`, name: "GB", passwordHash: "x" } })).id;
  BIDS.class = (await dbSystemTest.class.create({ data: { schoolId: B, name: uniq("K") } })).id;
  BIDS.user = (await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("9"), name: "SB", passwordHash: "x" } })).id;
  BIDS.profile = (await dbSystemTest.studentProfile.create({ data: { schoolId: B, userId: BIDS.user, classId: BIDS.class } })).id;
  BIDS.ta = (await dbSystemTest.teacherClass.create({ data: { schoolId: B, teacherId: BIDS.guru, classId: BIDS.class, subject: "MTK" } })).id;
  BIDS.log = (await dbSystemTest.auditLog.create({ data: { schoolId: B, action: "TEST.SEED" } })).id;
});
afterAll(async () => {
  await dbSystemTest.school.deleteMany({ where: { id: { in: [A, B] } } });
});

describe("tenant isolation", () => {
  it("SEMUA tabel public (kecuali _prisma_migrations) punya RLS + FORCE", async () => {
    const rows = await dbSystemTest.$queryRaw<{ relname: string; ok: boolean }[]>`
      SELECT c.relname, (c.relrowsecurity AND c.relforcerowsecurity) AS ok
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname <> '_prisma_migrations' AND c.relname NOT LIKE 'pg_%'`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
    expect(rows.map((r) => r.relname).sort()).toEqual(expect.arrayContaining([...RLS_TABLES].sort()));
  });

  it("User: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.user.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.user);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.findUniqueOrThrow({ where: { id: BIDS.user } }))).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.updateMany({ where: { id: BIDS.user }, data: { name: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.deleteMany({ where: { id: BIDS.user } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("8"), name: "j", passwordHash: "x" } })
    )).rejects.toThrow();
  });

  it("Class: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.class.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.class);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.class.updateMany({ where: { id: BIDS.class }, data: { name: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.class.deleteMany({ where: { id: BIDS.class } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.class.create({ data: { schoolId: B, name: uniq("J") } })
    )).rejects.toThrow();
  });

  it("TeacherClass: INSERT lintas sekolah pakai baris baru (gagal karena RLS)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.teacherClass.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.ta);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.teacherClass.updateMany({ where: { id: BIDS.ta }, data: { subject: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.teacherClass.deleteMany({ where: { id: BIDS.ta } }))).resolves.toMatchObject({ count: 0 });
    const g = await dbSystemTest.user.create({ data: { schoolId: B, role: "GURU", email: `${uniq("h")}@t.id`, name: "H", passwordHash: "x" } });
    const c = await dbSystemTest.class.create({ data: { schoolId: B, name: uniq("K") } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.teacherClass.create({ data: { schoolId: B, teacherId: g.id, classId: c.id, subject: "j" } })
    )).rejects.toThrow();
  });

  it("StudentProfile: INSERT lintas sekolah pakai user baru (gagal karena RLS)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.studentProfile.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.profile);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.studentProfile.updateMany({ where: { id: BIDS.profile }, data: { bio: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.studentProfile.deleteMany({ where: { id: BIDS.profile } }))).resolves.toMatchObject({ count: 0 });
    const u = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("7"), name: "F", passwordHash: "x" } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.studentProfile.create({ data: { schoolId: B, userId: u.id } })
    )).rejects.toThrow();
  });

  it("AuditLog: UPDATE/DELETE melempar (tanpa grant)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.auditLog.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.log);
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.updateMany({ where: { id: BIDS.log }, data: { action: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.deleteMany({ where: { id: BIDS.log } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.create({ data: { schoolId: B, action: "j" } })
    )).rejects.toThrow();
  });

  it("tanpa scope, app_user buta total (bukan error)", async () => {
    await expect(db.user.findMany()).resolves.toEqual([]);
  });

  it("School: scope A BOLEH membaca direktori semua sekolah", async () => {
    const schools = await runAsSchool(db, A, (tx: Tx) => tx.school.findMany({ select: { id: true } }));
    expect(schools.map((s) => s.id)).toEqual(expect.arrayContaining([A, B]));
  });

  it("School: INSERT/UPDATE/DELETE oleh app_user melempar", async () => {
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.create({ data: { slug: uniq("j"), name: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.updateMany({ where: { id: B }, data: { name: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.deleteMany({ where: { id: B } })
    )).rejects.toThrow();
  });
});
