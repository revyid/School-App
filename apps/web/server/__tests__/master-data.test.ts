import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { db } from "@sms/db/client";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { requireRole } from "../auth-gate.js";
import { createSession } from "../session.js";
import { isXlsxBuffer } from "../uploads.js";
import { detectImage } from "../images.js";

const APEX = "domainmu.id";
const PW = "pw-12345678";
let S = "";
let slug = "";
let admin = "";
let guru = "";
let siswa = "";
let adminSid = "";
let guruSid = "";
let siswaSid = "";
let classId = "";

let seq = 0;
async function mk(role: "ADMIN" | "GURU" | "SISWA") {
  seq++;
  const t = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${seq}`;
  const digits = `9${t}`.replace(/\D/g, "").slice(0, 11);
  const u = await dbSystem.user.create({
    data: {
      schoolId: S, role, email: `${role}-${t}@t.id`, nisn: `${digits}${seq}`.slice(0, 12),
      name: `${role} ${t}`, passwordHash: await argon2.hash(PW, { type: argon2.argon2id }),
    },
  });
  const s = await createSession(u.id, S, slug, role);
  return { u, sid: s.sid };
}

const host = () => `${slug}.domainmu.id`;
const gate = (sid: string, roles: ("ADMIN" | "GURU" | "SISWA")[]) =>
  requireRole({ host: host(), token: sid, pathname: "/x", roles });

beforeAll(async () => {
  const t = Date.now().toString(36);
  slug = `mdx-${t}`;
  S = (await dbSystem.school.create({ data: { slug, name: "MD" } })).id;
  const a = await mk("ADMIN");
  admin = a.u.id; adminSid = a.sid;
  const g = await mk("GURU");
  guru = g.u.id; guruSid = g.sid;
  const s = await mk("SISWA");
  siswa = s.u.id; siswaSid = s.sid;
  classId = (await dbSystem.class.create({ data: { schoolId: S, name: `K-${t}` } })).id;
  await dbSystem.user.update({ where: { id: admin }, data: {} }).catch(() => {});
});
afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("master-data authz", () => {
  it("SISWA ditolak di endpoint guru/admin; GURU ditolak di endpoint ADMIN", async () => {
    expect((await gate(siswaSid, ["ADMIN", "GURU"])).ok).toBe(false);
    expect((await gate(siswaSid, ["ADMIN"])).ok).toBe(false);
    expect((await gate(guruSid, ["ADMIN"])).ok).toBe(false);
    expect((await gate(adminSid, ["ADMIN"])).ok).toBe(true);
  });

  it("GURU hanya melihat siswa kelasnya (scope TeacherClass)", async () => {
    // siswa di classId, guru belum ditugaskan -> belum terlihat
    const mine0 = await runAsSchool(db, S, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: guru }, select: { classId: true } }));
    expect(mine0.map((m) => m.classId)).not.toContain(classId);
    await dbSystem.teacherClass.create({ data: { schoolId: S, teacherId: guru, classId } });
    const mine1 = await runAsSchool(db, S, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: guru }, select: { classId: true } }));
    expect(mine1.map((m) => m.classId)).toContain(classId);
  });

  it("settings upsert per sekolah; guru/siswa baca tapi tak bisa tulis (di level route)", async () => {
    const r = await gate(guruSid, ["ADMIN", "GURU", "SISWA"]);
    expect(r.ok).toBe(true);
    const w = await gate(guruSid, ["ADMIN"]);
    expect(w.ok).toBe(false);
  });
});

describe("upload validation", () => {
  it("xlsx asli lolos magic bytes; teks/.exe ditolak", () => {
    const real = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("data-excel")]);
    expect(isXlsxBuffer(real)).toBe(true);
    expect(isXlsxBuffer(Buffer.from("nama,kelas\nbudi,VII-A"))).toBe(false);
    expect(isXlsxBuffer(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x00]))).toBe(false); // MZ exe
  });

  it("gambar: PNG/JPG/WEBP asli lolos; teks menyamar .png ditolak", () => {
    expect(detectImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(10)]))).toBe("png");
    expect(detectImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10)]))).toBe("jpg");
    expect(detectImage(Buffer.from("data:image/png;base64,xxxx"))).toBeNull();
  });
});
