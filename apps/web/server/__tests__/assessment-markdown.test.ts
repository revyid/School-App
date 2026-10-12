import { describe, expect, it } from "vitest";
import {
  finalizeAssessmentImageUrls,
  hasInvalidPendingAssessmentImage,
  pendingAssessmentImageNames,
  stemReferencesAssessmentImage,
} from "../assessment-markdown";

describe("assessment markdown image references", () => {
  it("collects unique pending image filenames", () => {
    expect(pendingAssessmentImageNames(
      "Soal ![gambar](/api/assessment-images/q-0123456789abcdef.png)\n![lain](/api/assessment-images/q-0123456789abcdef.png)",
    )).toEqual(["q-0123456789abcdef.png"]);
  });

  it("rewrites uploaded file references to question-scoped Markdown URLs", () => {
    expect(finalizeAssessmentImageUrls(
      "Lihat ![diagram](/api/assessment-images/q-0123456789abcdef.jpg)",
      "question_123",
    )).toBe("Lihat ![diagram](/api/assess-files/question_123/q-0123456789abcdef.jpg)");
  });

  it("rejects malformed temporary image references", () => {
    expect(hasInvalidPendingAssessmentImage("![gambar](/api/assessment-images/../secret.png)")).toBe(true);
    expect(hasInvalidPendingAssessmentImage("![gambar](/api/assessment-images/q-0123456789abcdef.png)")).toBe(false);
  });

  it("allows a file only when its question stem references its scoped URL", () => {
    expect(stemReferencesAssessmentImage(
      "![gambar](/api/assess-files/q1/q-0123456789abcdef.png)",
      "q1",
      "q-0123456789abcdef.png",
    )).toBe(true);
    expect(stemReferencesAssessmentImage("Soal biasa", "q1", "q-0123456789abcdef.png")).toBe(false);
  });
});
