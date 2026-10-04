import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { db } from "@sms/db/client";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { requireRole } from "../auth-gate.js";
import { createSession } from "../session.js";

const PW = "pw-12345678";
let S = "";
let slug = "";
let seq = 0;

async function mkuser(role: "ADMIN" | "GURU" | "SISWA", classId?: string) {
  seq++;
  const t = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 4)}`;
  const u = await dbSystem.user.create({
    data: {
      schoolId: S, role, email: `att-${role}-${t}@t.id`, nisn: `8${t}`.replace(/\D/g, "").slice(0, 12),
      name: `${role} ${t}`, passwordHash: await argon2.hash(PW, { type: argon2.argon2id }),
      ...(classId && role === "SISWA" ? { studentProfile: { create: { schoolId: S, classId } } } : {}),
    },
  });
  const s = await createSession(u.id, S, slug, role);
  return { u, sid: s.sid };
}

const host = () => `${slug}.domainmu.id`;
let adminSid = "", guruSid = "", siswaSid = "";
let guru = "", siswaA = "", siswaB = "";
let classA = "", classB = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  slug = `attx-${t}`;
  S = (await dbSystem.school.create({ data: { slug, name: "ATT" } })).id;
  classA = (await dbSystem.class.create({ data: { schoolId: S, name: `A-${t}` } })).id;
  classB = (await dbSystem.class.create({ data: { schoolId: S, name: `B-${t}` } })).id;
  const ad = await mkuser("ADMIN");
  adminSid = ad.sid;
  const g = await mkuser("GURU");
  guru = g.u.id; guruSid = g.sid;
  const sa = await mkuser("SISWA", classA);
  siswaA = sa.u.id; siswaSid = sa.sid;
  const sb = await mkuser("SISWA", classB);
  siswaB = sb.u.id;
  // Guru hanya mengajar classA.
  await dbSystem.teacherClass.create({ data: { schoolId: S, teacherId: guru, classId: classA } });
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("otorisasi absensi guru-hanya-kelasnya", () => {
  it("guru lolos gate GURU; siswa ditolak di gate guru", async () => {
    const g = await requireRole({ host: host(), token: guruSid, pathname: "/x", roles: ["ADMIN", "GURU"] });
    expect(g.ok).toBe(true);
    const s = await requireRole({ host: host(), token: siswaSid, pathname: "/x", roles: ["ADMIN", "GURU"] });
    expect(s.ok).toBe(false);
  });

  it("scope kelas guru = classA saja (TeacherClass)", async () => {
    const mine = await runAsSchool(db, S, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: guru }, select: { classId: true } }));
    expect(mine.map((m) => m.classId)).toEqual([classA]);
    // siswaA sekelas dengan guru; siswaB beda kelas.
    const pa = await runAsSchool(db, S, (tx) => tx.studentProfile.findUnique({ where: { userId: siswaA } }));
    const pb = await runAsSchool(db, S, (tx) => tx.studentProfile.findUnique({ where: { userId: siswaB } }));
    expect(pa?.classId).toBe(classA);
    expect(pb?.classId).toBe(classB);
  });

  it("admin lolos gate ADMIN; guru ditolak di gate ADMIN (kalender/ekspor)", async () => {
    const a = await requireRole({ host: host(), token: adminSid, pathname: "/x", roles: ["ADMIN"] });
    expect(a.ok).toBe(true);
    const g = await requireRole({ host: host(), token: guruSid, pathname: "/x", roles: ["ADMIN"] });
    expect(g.ok).toBe(false);
  });
});
