import { describe, it, expect } from "vitest";
import { announcementVisible, collabSenderShown } from "./portal.js";
import { expRulesSchema } from "./master.js";

describe("announcementVisible", () => {
  it("ALL semua; GURU/SISWA sesuai peran; kelas: cocok classId", () => {
    expect(announcementVisible("ALL", { role: "SISWA", classId: null })).toBe(true);
    expect(announcementVisible("GURU", { role: "GURU", classId: null })).toBe(true);
    expect(announcementVisible("GURU", { role: "SISWA", classId: "c1" })).toBe(false);
    expect(announcementVisible("SISWA", { role: "SISWA", classId: "c1" })).toBe(true);
    expect(announcementVisible("kelas:c1", { role: "SISWA", classId: "c1" })).toBe(true);
    expect(announcementVisible("kelas:c1", { role: "SISWA", classId: "c2" })).toBe(false);
    expect(announcementVisible("kelas:c1", { role: "GURU", classId: null })).toBe(false);
  });
});

describe("collabSenderShown", () => {
  it("non-anonim selalu tampil; anonim hanya pengirim + admin-reveal", () => {
    const anon = { anonymous: true, senderId: "s1" };
    expect(collabSenderShown({ anonymous: false, senderId: "s1" }, { role: "GURU", userId: "g1", revealed: false })).toBe(true);
    expect(collabSenderShown(anon, { role: "GURU", userId: "g1", revealed: false })).toBe(false);
    expect(collabSenderShown(anon, { role: "SISWA", userId: "s1", revealed: false })).toBe(true);
    expect(collabSenderShown(anon, { role: "ADMIN", userId: "a1", revealed: false })).toBe(false);
    expect(collabSenderShown(anon, { role: "ADMIN", userId: "a1", revealed: true })).toBe(true);
  });
});

describe("expRulesSchema", () => {
  it("default terisi; negatif ditolak; kunci asing ditolak (strict)", () => {
    const d = expRulesSchema.parse({});
    expect(d.submitTepat).toBe(10);
    expect(() => expRulesSchema.parse({ submitTepat: -1 })).toThrow();
    expect(() => expRulesSchema.parse({ ngarang: 1 })).toThrow();
  });
});
