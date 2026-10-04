import { describe, it, expect } from "vitest";
import { scanDecision, parseDay, todayWib, SCAN_COOLDOWN_SEC, pickAutoAlpha } from "./attendance.js";

describe("scanDecision (idempoten + cooldown)", () => {
  const now = new Date("2026-10-05T00:30:00Z");
  it("tanpa record -> ok", () => {
    expect(scanDecision(null, now, SCAN_COOLDOWN_SEC)).toEqual({ ok: true });
  });
  it("HADIR baru saja -> cooldown", () => {
    const r = scanDecision(
      { status: "HADIR", scannedAt: new Date(now.getTime() - 10_000) },
      now,
      SCAN_COOLDOWN_SEC,
    );
    expect(r).toEqual({ ok: false, reason: "cooldown" });
  });
  it("HADIR lama -> already (tanpa duplikat)", () => {
    const r = scanDecision(
      { status: "HADIR", scannedAt: new Date(now.getTime() - 3600_000) },
      now,
      SCAN_COOLDOWN_SEC,
    );
    expect(r).toEqual({ ok: false, reason: "already" });
  });
  it("ALPHA/auto -> boleh timpa jadi HADIR", () => {
    expect(scanDecision({ status: "ALPHA", scannedAt: null }, now, SCAN_COOLDOWN_SEC)).toEqual({ ok: true });
    expect(scanDecision({ status: "IZIN", scannedAt: null }, now, SCAN_COOLDOWN_SEC)).toEqual({ ok: true });
  });
});

describe("parseDay/todayWib", () => {
  it("parse valid + tolak invalid", () => {
    expect(parseDay("2026-10-05")?.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(parseDay("05/10/2026")).toBeNull();
  });
  it("todayWib tengah malam UTC", () => {
    const t = todayWib();
    expect(t.getUTCHours()).toBe(0);
  });
});

describe("pickAutoAlpha", () => {
  const base = {
    students: [
      { id: "s1", classId: "k1" },
      { id: "s2", classId: "k1" },
      { id: "s3", classId: "k2" },
    ],
    approvedLeave: new Set<string>(),
    hasTimetable: (c: string | null) => c === "k1",
  };
  it("tandai yang tanpa record & ada jadwal", () => {
    expect(
      pickAutoAlpha({ ...base, existing: new Map(), calendar: [] }),
    ).toEqual(["s1", "s2"]);
  });
  it("libur global -> kosong", () => {
    expect(
      pickAutoAlpha({ ...base, existing: new Map(), calendar: [{ kind: "LIBUR", classId: null }] }),
    ).toEqual([]);
  });
  it("sudah hadir + izin approved dilewati", () => {
    expect(
      pickAutoAlpha({
        ...base,
        existing: new Map([["s1", "HADIR"]]),
        calendar: [],
        approvedLeave: new Set(["s2"]),
      }),
    ).toEqual([]);
  });
  it("override EFEKTIF tanpa jadwal tetap ditandai", () => {
    expect(
      pickAutoAlpha({
        students: [{ id: "s3", classId: "k2" }],
        existing: new Map(),
        calendar: [{ kind: "EFEKTIF", classId: "k2" }],
        approvedLeave: new Set(),
        hasTimetable: () => false,
      }),
    ).toEqual(["s3"]);
  });
  it("libur kelas dilewati", () => {
    expect(
      pickAutoAlpha({
        ...base,
        existing: new Map(),
        calendar: [{ kind: "LIBUR", classId: "k1" }],
      }),
    ).toEqual([]);
  });
});
