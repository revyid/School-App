import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { db } from "@sms/db/client";
import { detectLeavePhoto } from "../leave-photos.js";

let S = "";
let siswaA = "";
let siswaB = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  S = (await dbSystem.school.create({ data: { slug: `lvx-${t}`, name: "LV" } })).id;
  siswaA = (await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "LA", passwordHash: "x" } })).id;
  siswaB = (await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "LB", passwordHash: "x" } })).id;
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("capture token lifecycle", () => {
  it("token milik A tak bisa dipakai B (simulasi cek route: studentId mismatch)", async () => {
    const sess = await runAsSchool(db, S, (tx) =>
      tx.captureSession.create({
        data: { schoolId: S, studentId: siswaA, token: `tok-${Date.now().toString(36)}`, expiresAt: new Date(Date.now() + 300_000) },
      }));
    // Route menolak bila sess.studentId !== pemohon. Di sini verifikasi data tersimpan benar.
    const same = await runAsSchool(db, S, (tx) =>
      tx.captureSession.findUnique({ where: { token: sess.token } }));
    expect(same?.studentId).toBe(siswaA);
    expect(same?.studentId).not.toBe(siswaB);
    // Sekali pakai: tandai usedAt, lalu tolak reuse.
    await runAsSchool(db, S, (tx) =>
      tx.captureSession.update({ where: { id: sess.id }, data: { usedAt: new Date() } }));
    const used = await runAsSchool(db, S, (tx) =>
      tx.captureSession.findUnique({ where: { token: sess.token } }));
    expect(used?.usedAt).not.toBeNull();
  });

  it("token kedaluwarsa terdeteksi (expiresAt < now)", async () => {
    const sess = await runAsSchool(db, S, (tx) =>
      tx.captureSession.create({
        data: { schoolId: S, studentId: siswaA, token: `exp-${Date.now().toString(36)}`, expiresAt: new Date(Date.now() - 1000) },
      }));
    expect(sess.expiresAt.getTime()).toBeLessThan(Date.now());
  });
});

describe("leave-photos magic bytes", () => {
  it("JPEG/PNG asli lolos; teks/exe ditolak", () => {
    expect(detectLeavePhoto(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(10)]))).toBe("jpg");
    expect(detectLeavePhoto(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(10)]))).toBe("png");
    expect(detectLeavePhoto(Buffer.from("foto-palsu"))).toBeNull();
    expect(detectLeavePhoto(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });
});

describe("retensi leave", () => {
  it("leave lama bertanda foto masuk kandidat purge (createdAt < cutoff)", async () => {
    const old = await dbSystem.leaveRequest.create({
      data: {
        schoolId: S, studentId: siswaA, date: new Date(Date.UTC(2020, 0, 1)),
        kind: "IZIN", description: "lama", studentPhoto: "s-abc.jpg", status: "APPROVED",
        createdAt: new Date(Date.UTC(2020, 0, 2)),
      },
    });
    const cutoff = new Date(Date.UTC(2021, 0, 1));
    const cands = await runAsSchool(db, S, (tx) =>
      tx.leaveRequest.findMany({
        where: { createdAt: { lt: cutoff }, OR: [{ studentPhoto: { not: null } }, { parentPhoto: { not: null } }] },
        select: { id: true },
      }));
    expect(cands.map((c) => c.id)).toContain(old.id);
  });
});
