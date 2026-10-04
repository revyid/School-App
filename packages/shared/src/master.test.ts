import { describe, it, expect } from "vitest";
import {
  validateImportRow,
  normalizePhone,
  normalizeGender,
  parseBirthDate,
} from "./master.js";

describe("normalizePhone", () => {
  it("0812... -> 62812...", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
  });
  it("+62... dipertahankan; 8... diberi prefix 62", () => {
    expect(normalizePhone("+6281234567890")).toBe("6281234567890");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
  });
  it("pendek/asing/null -> null", () => {
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("normalizeGender", () => {
  it.each([["L", "L"], ["laki-laki", "L"], ["P", "P"], ["perempuan", "P"]])("%s -> %s", (a, b) => {
    expect(normalizeGender(a)).toBe(b);
  });
  it("tak dikenal -> null", () => {
    expect(normalizeGender("X")).toBeNull();
    expect(normalizeGender(null)).toBeNull();
  });
});

describe("parseBirthDate", () => {
  it("ISO + dd/mm/yyyy + serial Excel", () => {
    expect(parseBirthDate("2012-05-01")?.getFullYear()).toBe(2012);
    expect(parseBirthDate("01/05/2012")?.getMonth()).toBe(4);
    expect(parseBirthDate(41000)).toBeInstanceOf(Date);
  });
  it("sampah -> null", () => {
    expect(parseBirthDate("bukan tanggal")).toBeNull();
    expect(parseBirthDate("")).toBeNull();
  });
});

describe("validateImportRow", () => {
  it("baris valid lolos", () => {
    const r = validateImportRow(
      { Nama: "Budi", JK: "L", NISN: "1234567890", "Tgl Lahir": "2012-01-02", Kelas: "VII-A", "No Ortu": "08123456789" },
      2,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.nisn).toBe("1234567890");
      expect(r.parentPhone).toBe("628123456789");
    }
  });
  it("baris rusak: Nama/NISN/Kelas kosong + JK aneh", () => {
    const r = validateImportRow({ Nama: "", JK: "X", NISN: "ab", Kelas: "" }, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.rowNumber).toBe(5);
      expect(r.errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});
