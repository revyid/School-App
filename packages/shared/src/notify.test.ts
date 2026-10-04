import { describe, it, expect } from "vitest";
import { normalizePhone, renderTemplate, DEFAULT_TEMPLATES } from "./notify.js";

describe("normalizePhone", () => {
  it("08.. -> 62.., +62 tetap, invalid ditolak", () => {
    expect(normalizePhone("0812-3456-789")).toBe("628123456789");
    expect(normalizePhone("+62812 3456 789")).toBe("628123456789");
    expect(normalizePhone("628123456789")).toBe("628123456789");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("renderTemplate", () => {
  it("ganti {{var}}, unknown -> kosong", () => {
    expect(renderTemplate("Halo {{nama}} ({{kelas}})", { nama: "Budi", kelas: "VII-A" }))
      .toBe("Halo Budi (VII-A)");
    expect(renderTemplate("{{x}}!", {})).toBe("!");
    expect(renderTemplate(DEFAULT_TEMPLATES.alpha, { nama: "A", kelas: "K", tanggal: "2026-10-05" }))
      .toContain("ALPHA");
  });
});
