import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { db } from "@sms/db/client";
import { buildGradebook } from "../gradebook.js";

let S = "";
let cls = "";
let s1 = "";
let s2 = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  S = (await dbSystem.school.create({ data: { slug: `gbx-${t}`, name: "GB" } })).id;
  cls = (await dbSystem.class.create({ data: { schoolId: S, name: `K-${t}` } })).id;
  s1 = (await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "S1", passwordHash: "x" } })).id;
  s2 = (await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "S2", passwordHash: "x" } })).id;
  for (const sid of [s1, s2]) {
    await dbSystem.studentProfile.create({ data: { schoolId: S, userId: sid, classId: cls } });
  }
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("buildGradebook", () => {
  it("agregasi tugas (rata-rata) + asesmen (normalisasi 0-100) + avg gabungan", async () => {
    const guru = await dbSystem.user.create({ data: { schoolId: S, role: "GURU", name: "G", passwordHash: "x" } });
    const task = await dbSystem.task.create({
      data: { schoolId: S, classId: cls, authorId: guru.id, title: "T1", instruction: "kerjakan" },
    });
    await dbSystem.submission.create({
      data: { schoolId: S, taskId: task.id, studentId: s1, score: 80 },
    });
    const as = await dbSystem.assessment.create({
      data: { schoolId: S, classId: cls, authorId: guru.id, title: "UH" },
    });
    // skor 15/30 -> normalisasi 50.
    await dbSystem.assessAttempt.create({
      data: { schoolId: S, assessmentId: as.id, studentId: s1, submittedAt: new Date(), score: 15, maxScore: 30 },
    });
    const gb = await buildGradebook(S, "ADMIN", guru.id, cls, null);
    if ("error" in gb) throw new Error(gb.error);
    expect(gb.tasks.map((t) => t.id)).toContain(task.id);
    const r1 = gb.rows.find((r) => r.studentId === s1)!;
    expect(r1.taskScores[task.id]).toBe(80);
    expect(r1.assessScores[as.id]).toBe(50);
    // avg = (80 + 50) / 2 = 65.
    expect(r1.avg).toBe(65);
    const r2 = gb.rows.find((r) => r.studentId === s2)!;
    expect(r2.avg).toBeNull();
  });

  it("guru luar kelas ditolak; audit tak bocor lintas sekolah", async () => {
    const outsider = await dbSystem.user.create({ data: { schoolId: S, role: "GURU", name: "GO", passwordHash: "x" } });
    const denied = await buildGradebook(S, "GURU", outsider.id, cls, null);
    expect("error" in denied && denied.status).toBe(403);
    await dbSystem.auditLog.create({
      data: { schoolId: S, action: "TEST.GB", actorId: outsider.id },
    });
    const other = await dbSystem.school.create({ data: { slug: `gbo-${Date.now().toString(36)}`, name: "GO" } });
    const leaked = await runAsSchool(db, other.id, (tx) =>
      tx.auditLog.findMany({ where: { action: "TEST.GB" }, select: { id: true } }));
    expect(leaked).toHaveLength(0);
    await dbSystem.school.deleteMany({ where: { id: other.id } });
  });
});
