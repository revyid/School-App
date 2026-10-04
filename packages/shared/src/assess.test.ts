import { describe, it, expect } from "vitest";
import {
  seedFrom, shuffled, toClientQuestions, gradeAttempt, itemAnalysis,
  type QRow,
} from "./assess.js";

const mcq: QRow = {
  id: "q1", type: "MCQ", stem: "2+2?", imageName: null,
  options: ["3", "4", "5"], correctIndex: 1, correctOrder: [], points: 10,
};
const sorting: QRow = {
  id: "q2", type: "SORTING", stem: "Urutkan", imageName: null,
  options: ["A", "B", "C"], correctIndex: null, correctOrder: [0, 1, 2], points: 9,
};

describe("seed/shuffle deterministik", () => {
  it("seed sama -> urutan sama; seed beda -> (umumnya) beda", () => {
    const s1 = seedFrom("s", "a", "u1");
    expect(seedFrom("s", "a", "u1")).toBe(s1);
    expect(seedFrom("s", "a", "u2")).not.toBe(s1);
    expect(shuffled([1, 2, 3, 4, 5], s1)).toEqual(shuffled([1, 2, 3, 4, 5], s1));
  });
});

describe("toClientQuestions: kunci tak bocor", () => {
  it("clientQs tanpa correctIndex/correctOrder; jumlah sama", () => {
    const { clientQs, qOrder, optOrders } = toClientQuestions([mcq, sorting], {
      shuffleQ: true, shuffleOpt: true, seed: 42,
    });
    expect(clientQs).toHaveLength(2);
    expect(qOrder).toHaveLength(2);
    for (const c of clientQs) {
      expect(c).not.toHaveProperty("correctIndex");
      expect(c).not.toHaveProperty("correctOrder");
      expect(JSON.stringify(c)).not.toContain("correctIndex");
    }
    expect(Object.keys(optOrders)).toHaveLength(2);
  });
});

describe("gradeAttempt via koordinat acak", () => {
  it("MCQ benar penuh / salah nol (pemetaan order server)", () => {
    // order opsi q1 = [2,0,1] (acak); kunci asli index 1 ada di posisi acak 2.
    const optOrders = { q1: [2, 0, 1], q2: [0, 1, 2] };
    const ok = gradeAttempt([mcq], optOrders, [{ questionId: "q1", pickedIndex: 2 }]);
    expect(ok.score).toBe(10);
    expect(ok.perQ[0].pickedIndex).toBe(1); // koordinat asli
    const wrong = gradeAttempt([mcq], optOrders, [{ questionId: "q1", pickedIndex: 0 }]);
    expect(wrong.score).toBe(0);
  });

  it("SORTING parsial proporsional; sempurna -> penuh", () => {
    const optOrders = { q2: [0, 1, 2] };
    const full = gradeAttempt([sorting], optOrders, [{ questionId: "q2", pickedOrder: [0, 1, 2] }]);
    expect(full.score).toBe(9);
    // [0,2,1]: hanya posisi 0 benar -> round(9*1/3)=3.
    const part = gradeAttempt([sorting], optOrders, [{ questionId: "q2", pickedOrder: [0, 2, 1] }]);
    expect(part.score).toBe(3);
    expect(part.perQ[0].isCorrect).toBe(false);
  });

  it("tanpa jawaban -> nol, tak crash", () => {
    const r = gradeAttempt([mcq, sorting], { q1: [0, 1, 2], q2: [0, 1, 2] }, []);
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(19);
  });
});

describe("itemAnalysis", () => {
  it("difficulty = proporsi benar; distraktor terhitung", () => {
    const rows = [
      { questionId: "q1", pickedIndex: 1 as number | null, pickedOrder: [] as number[], isCorrect: true },
      { questionId: "q1", pickedIndex: 0 as number | null, pickedOrder: [] as number[], isCorrect: false },
      { questionId: "q1", pickedIndex: 1 as number | null, pickedOrder: [] as number[], isCorrect: true },
    ];
    const [it1] = itemAnalysis([mcq], rows);
    expect(it1.n).toBe(3);
    expect(it1.difficulty).toBeCloseTo(2 / 3);
    expect(it1.distractors).toEqual({ "0": 1, "1": 2, "2": 0 });
  });
});
