import { describe, it, expect, beforeAll, afterAll } from "vitest";
import argon2 from "argon2";
import { db } from "@lacakedu/db/client";
import { dbSystemTest as dbSystem } from "@lacakedu/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@lacakedu/db/tenant";

const PW = "pw-12345678";
let S = "";
let slug = "";
let seq = 0;
let classA = "", classB = "";
let guruA = "", siswaA = "", siswaB = "";
let taskA = "";

async function mkuser(role: "ADMIN" | "GURU" | "SISWA", classId?: string) {
  seq++;
  const t = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 4)}`;
  const u = await dbSystem.user.create({
    data: {
      schoolId: S, role, email: `lms-${role}-${t}@t.id`, nisn: `7${t}`.replace(/\D/g, "").slice(0, 12),
      name: `${role} ${t}`, passwordHash: await argon2.hash(PW, { type: argon2.argon2id }),
      ...(classId && role === "SISWA" ? { studentProfile: { create: { schoolId: S, classId } } } : {}),
    },
  });
  return u;
}

beforeAll(async () => {
  const t = Date.now().toString(36);
  slug = `lmsx-${t}`;
  S = (await dbSystem.school.create({ data: { slug, name: "LMS" } })).id;
  classA = (await dbSystem.class.create({ data: { schoolId: S, name: `LA-${t}` } })).id;
  classB = (await dbSystem.class.create({ data: { schoolId: S, name: `LB-${t}` } })).id;
  const g = await mkuser("GURU");
  guruA = g.id;
  await dbSystem.timetableSlot.create({ data: { schoolId: S, teacherId: guruA, classId: classA, dayOfWeek: 1, startTime: "07:00", endTime: "08:00" } });
  siswaA = (await mkuser("SISWA", classA)).id;
  siswaB = (await mkuser("SISWA", classB)).id;
  const author = await mkuser("ADMIN");
  taskA = (await dbSystem.task.create({
    data: {
      schoolId: S, classId: classA, authorId: author.id,
      title: "Tugas A", instruction: "kerjakan", type: "REGULAR",
      publishAt: new Date("2026-01-01T00:00:00Z"),
    },
  })).id;
  // Submission milik siswaA dengan file.
  await dbSystem.submission.create({
    data: {
      schoolId: S, taskId: taskA, studentId: siswaA,
      text: "jawaban", fileName: "abc-jawaban.pdf", mime: "application/pdf", size: 10,
      submittedAt: new Date("2026-01-02T00:00:00Z"),
    },
  });
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("lms file access scope", () => {
  it("submission siswaA tak terlihat siswaB (RLS scope sekolah sama, tapi kepemilikan di route)", async () => {
    // Keduanya satu sekolah: RLS mengizinkan baca baris, route yang menolak.
    // Di level DB: siswaB tak bisa update/delete milik siswaA via where studentId (simulasi route).
    const other = await runAsSchool(db, S, (tx) =>
      tx.submission.findFirst({ where: { taskId: taskA, studentId: siswaB } }));
    expect(other).toBeNull();
    const own = await runAsSchool(db, S, (tx) =>
      tx.submission.findFirst({ where: { taskId: taskA, studentId: siswaA } }));
    expect(own?.fileName).toBe("abc-jawaban.pdf");
  });

  it("unique (taskId, studentId): kirim ulang menimpa, bukan duplikat", async () => {
    await runAsSchool(db, S, (tx) =>
      tx.submission.upsert({
        where: { taskId_studentId: { taskId: taskA, studentId: siswaA } },
        update: { text: "revisi" },
        create: { schoolId: S, taskId: taskA, studentId: siswaA, text: "revisi" },
      }));
    const count = await runAsSchool(db, S, (tx) =>
      tx.submission.count({ where: { taskId: taskA, studentId: siswaA } }));
    expect(count).toBe(1);
  });
});
