import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  TIMETABLE_HEADER,
  TIMETABLE_ALL_HEADER,
  DAY_FULL,
  parseDayLabel,
  buildTimetableWorkbook,
  buildTimetableTemplate,
  parseTimetableBuffer,
  buildTimetableAllWorkbook,
  buildTimetableAllTemplate,
  parseTimetableAllBuffer,
} from "../timetable-xlsx.js";

const ROWS = [
  { dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Budi Santoso" },
  { dayOfWeek: 1, startTime: "07:45", endTime: "08:30", subject: "IPA", teacher: "Siti Aminah" },
  { dayOfWeek: 2, startTime: "07:00", endTime: "08:30", subject: "Bahasa Inggris", teacher: "Budi Santoso" },
  { dayOfWeek: 3, startTime: "10:00", endTime: "11:30", subject: "IPS", teacher: "" },
  { dayOfWeek: 5, startTime: "07:00", endTime: "07:45", subject: "Seni", teacher: "Dewi" },
];

describe("timetable xlsx format sendiri (Hari|Mulai|Selesai|Mapel|Guru)", () => {
  it("header persis format sendiri", () => {
    expect(TIMETABLE_HEADER).toEqual(["Hari", "Mulai", "Selesai", "Mapel", "Guru"]);
    expect(DAY_FULL).toEqual(["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]);
  });

  it("parseDayLabel terima nama Indonesia, singkatan, angka, Inggris", () => {
    expect(parseDayLabel("Senin")).toBe(1);
    expect(parseDayLabel("sen")).toBe(1);
    expect(parseDayLabel("  SELASA ")).toBe(2);
    expect(parseDayLabel("rab")).toBe(3);
    expect(parseDayLabel("KAMIS")).toBe(4);
    expect(parseDayLabel("Jumat")).toBe(5);
    expect(parseDayLabel("sabtu")).toBe(6);
    expect(parseDayLabel("minggu")).toBe(0);
    expect(parseDayLabel("1")).toBe(1);
    expect(parseDayLabel(5)).toBe(5);
    expect(parseDayLabel("Monday")).toBe(1);
    expect(parseDayLabel("Funday")).toBeNull();
    expect(parseDayLabel("")).toBeNull();
  });

  it("round-trip export→import 5 slot kembali 5 baris sama", () => {
    const buf = buildTimetableWorkbook(ROWS);
    const { rows, errors } = parseTimetableBuffer(buf);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(5);
    expect(rows).toEqual(ROWS);
  });

  it("jam invalid → error per baris (bukan lempar)", () => {
    const buf = buildTimetableWorkbook([
      ...ROWS.slice(0, 2),
      { dayOfWeek: 1, startTime: "25:00", endTime: "26:00", subject: "Ngawur", teacher: "" },
    ]);
    // rusak manual sel jam agar lolos build: tulis mentah via parse
    void buf;
    const bad = buildTimetableWorkbook(ROWS.slice(0, 2));
    const { rows } = parseTimetableBuffer(bad);
    expect(rows).toHaveLength(2);
    // jam invalid: bangun workbook lalu timpa sel waktu
    const wb = XLSX.read(bad, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    ws["B3"] = { t: "s", v: "25:00" };
    ws["C3"] = { t: "s", v: "24:00" };
    const buf2: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const res2 = parseTimetableBuffer(buf2);
    expect(res2.rows).toHaveLength(1);
    expect(res2.errors).toHaveLength(1);
    expect(res2.errors[0].baris).toBe(3);
    expect(res2.errors[0].pesan).toMatch(/jam/i);
  });

  it("hari tak dikenal + mapel kosong → error per baris", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...TIMETABLE_HEADER],
      ["Funday", "07:00", "07:45", "Matematika", "Budi"],
      ["Senin", "07:00", "07:45", "", "Budi"],
      ["Senin", "08:30", "07:00", "IPA", "Siti"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const { rows, errors } = parseTimetableBuffer(buf);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(3);
  });

  it("template memuat header format sendiri + contoh", () => {
    const buf = buildTimetableTemplate();
    const { rows, errors } = parseTimetableBuffer(buf);
    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({ dayOfWeek: 1, startTime: "07:00" });
  });
});

describe("timetable xlsx global (Kelas|Hari|Mulai|Selesai|Mapel|Guru)", () => {
  const ALL_ROWS = [
    { kelas: "X-IPA-1", dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Budi" },
    { kelas: "X-IPA-2", dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Budi" },
    { kelas: "X-IPA-1", dayOfWeek: 2, startTime: "08:00", endTime: "08:45", subject: "IPA", teacher: "" },
  ];

  it("header global 6 kolom", () => {
    expect(TIMETABLE_ALL_HEADER).toEqual(["Kelas", "Hari", "Mulai", "Selesai", "Mapel", "Guru"]);
  });

  it("round-trip export→import kembali sama", () => {
    const buf = buildTimetableAllWorkbook(ALL_ROWS);
    const { rows, errors } = parseTimetableAllBuffer(buf);
    expect(errors).toEqual([]);
    expect(rows).toEqual(ALL_ROWS);
  });

  it("kelas kosong + format lama → ditolak dengan pesan jelas", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [...TIMETABLE_ALL_HEADER],
      ["", "Senin", "07:00", "07:45", "Matematika", "Budi"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const res = parseTimetableAllBuffer(buf);
    expect(res.rows).toEqual([]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].pesan).toMatch(/kelas/i);
    // file format lama (5 kolom) → header tak sesuai
    const oldBuf = buildTimetableWorkbook([
      { dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "MTK", teacher: "Budi" },
    ]);
    const res2 = parseTimetableAllBuffer(oldBuf);
    expect(res2.rows).toEqual([]);
    expect(res2.errors[0].pesan).toMatch(/Kelas\|Hari/i);
  });

  it("template global memuat 3 contoh 2 kelas", () => {
    const buf = buildTimetableAllTemplate();
    const { rows, errors } = parseTimetableAllBuffer(buf);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.kelas)).size).toBe(2);
  });
});
