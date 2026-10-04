import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { db } from "@sms/db/client";
import { toClientQuestions, type QRow } from "@sms/shared/assess";

let S = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  S = (await dbSystem.school.create({ data: { slug: `asx-${t}`, name: "AS" } })).id;
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("integritas kunci jawaban", () => {
  it("payload ke siswa (hasil toClientQuestions) tak mengandung kunci dalam bentuk apa pun", async () => {
    const q = await dbSystem.question.create({
      data: {
        schoolId: S, authorId: "x", type: "MCQ", stem: "Rahasia?",
        options: ["A", "B", "C", "D"], correctIndex: 2,
      },
    });
    const rows: QRow[] = [{
      id: q.id, type: "MCQ", stem: q.stem, imageName: null, options: q.options,
      correctIndex: q.correctIndex, correctOrder: [], points: 10,
    }];
    const { clientQs } = toClientQuestions(rows, { shuffleQ: true, shuffleOpt: true, seed: 7 });
    const payload = JSON.stringify({ questions: clientQs });
    expect(payload).not.toContain("correctIndex");
    expect(payload).not.toContain("correctOrder");
    // Opsi masih lengkap (pengecoh ikut terkirim — wajar; yang disembunyikan = mana yang benar).
    expect(clientQs[0].options).toHaveLength(4);
  });

  it("kolom kunci hanya terbaca via scope sekolah yang sama (RLS)", async () => {
    const other = await dbSystem.school.create({ data: { slug: `aso-${Date.now().toString(36)}`, name: "AO" } });
    const q = await dbSystem.question.create({
      data: { schoolId: S, authorId: "x", type: "MCQ", stem: "Q?", options: ["A", "B"], correctIndex: 0 },
    });
    const viaOther = await runAsSchool(db, other.id, (tx) =>
      tx.question.findMany({ select: { id: true } }));
    expect(viaOther.map((r) => r.id)).not.toContain(q.id);
    await dbSystem.school.deleteMany({ where: { id: other.id } });
  });
});
