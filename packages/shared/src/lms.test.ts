import { describe, it, expect } from "vitest";
import {
  isVisibleToStudent, submitState, canSubmit, isLateSubmit,
} from "./lms.js";

const T = (h: string) => new Date(h);
const base = { publishAt: T("2026-10-01T00:00:00Z"), deadline: T("2026-10-10T00:00:00Z"), allowLate: false };

describe("visibilitas publishAt", () => {
  it("sebelum publishAt -> tak terlihat; sesudah -> terlihat", () => {
    expect(isVisibleToStudent(base, T("2026-09-30T00:00:00Z"))).toBe(false);
    expect(isVisibleToStudent(base, T("2026-10-01T00:00:00Z"))).toBe(true);
    expect(isVisibleToStudent(base, T("2026-10-05T00:00:00Z"))).toBe(true);
  });
});

describe("late logic", () => {
  it("kumpul tepat waktu -> SUDAH, bukan late", () => {
    expect(submitState(base, T("2026-10-09T00:00:00Z"), T("2026-10-09T00:00:00Z"))).toBe("SUDAH");
    expect(isLateSubmit(base, T("2026-10-09T00:00:00Z"))).toBe(false);
  });
  it("kumpul lewat deadline -> TERLAMBAT + late", () => {
    expect(submitState(base, T("2026-10-11T00:00:00Z"), T("2026-10-11T00:00:00Z"))).toBe("TERLAMBAT");
    expect(isLateSubmit(base, T("2026-10-11T00:00:00Z"))).toBe(true);
  });
  it("belum kumpul + deadline lewat + tak boleh late -> TUTUP, canSubmit false", () => {
    expect(submitState(base, null, T("2026-10-11T00:00:00Z"))).toBe("TUTUP");
    expect(canSubmit(base, T("2026-10-11T00:00:00Z"))).toBe(false);
  });
  it("belum kumpul + allowLate -> BELUM walau deadline lewat, canSubmit true", () => {
    const t = { ...base, allowLate: true };
    expect(submitState(t, null, T("2026-10-11T00:00:00Z"))).toBe("BELUM");
    expect(canSubmit(t, T("2026-10-11T00:00:00Z"))).toBe(true);
  });
  it("tanpa deadline -> selalu BELUM/canSubmit", () => {
    const t = { publishAt: base.publishAt, deadline: null, allowLate: false };
    expect(submitState(t, null, T("2027-01-01T00:00:00Z"))).toBe("BELUM");
    expect(canSubmit(t, T("2027-01-01T00:00:00Z"))).toBe(true);
  });
});
