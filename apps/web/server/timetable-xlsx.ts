// Helper murni format Excel jadwal: Hari|Mulai|Selesai|Mapel|Guru (per-kelas)
// dan Kelas|Hari|Mulai|Selesai|Mapel|Guru (global all-kelas).
// Dipakai route export/import + test round-trip. Tanpa akses DB.
import * as XLSX from "xlsx";

export const TIMETABLE_HEADER = ["Hari", "Mulai", "Selesai", "Mapel", "Guru"] as const;
export const TIMETABLE_ALL_HEADER = ["Kelas", "Hari", "Mulai", "Selesai", "Mapel", "Guru"] as const;

export const DAY_FULL = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const DAY_ABBR: Record<string, number> = {
  min: 0, ming: 0, minggu: 0, sun: 0, sunday: 0,
  sen: 1, senin: 1, mon: 1, monday: 1,
  sel: 2, selasa: 2, tue: 2, tues: 2, tuesday: 2,
  rab: 3, rabu: 3, wed: 3, wednesday: 3,
  kam: 4, kamis: 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  jum: 5, jumat: 5, "jum'at": 5, fri: 5, friday: 5,
  sab: 6, sabtu: 6, sat: 6, saturday: 6,
};

/** Terima nama hari Indonesia/Inggris/singkatan/angka → 0-6, tak dikenal → null. */
export function parseDayLabel(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6) return v;
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "") return null;
  if (/^[0-6]$/.test(s)) return Number(s);
  if (s === "7") return 0;
  return DAY_ABBR[s] ?? null;
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface TimetableRowInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
}

export interface TimetableParseError {
  baris: number;
  pesan: string;
}

function normCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Bangun buffer .xlsx dari daftar slot (format sendiri). */
export function buildTimetableWorkbook(rows: TimetableRowInput[]): Buffer {
  const aoa: (string | number)[][] = [[...TIMETABLE_HEADER]];
  for (const r of rows) {
    aoa.push([DAY_FULL[r.dayOfWeek] ?? "", r.startTime, r.endTime, r.subject, r.teacher]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Template kosong + contoh, header sama dengan export. */
export function buildTimetableTemplate(): Buffer {
  return buildTimetableWorkbook([
    { dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Nama Guru" },
    { dayOfWeek: 1, startTime: "07:45", endTime: "08:30", subject: "IPA", teacher: "Nama Guru" },
  ]);
}

export interface TimetableAllRowInput extends TimetableRowInput {
  kelas: string;
}

/** Bangun buffer .xlsx global all-kelas: Kelas|Hari|Mulai|Selesai|Mapel|Guru. */
export function buildTimetableAllWorkbook(rows: TimetableAllRowInput[]): Buffer {
  const aoa: (string | number)[][] = [[...TIMETABLE_ALL_HEADER]];
  for (const r of rows) {
    aoa.push([r.kelas, DAY_FULL[r.dayOfWeek] ?? "", r.startTime, r.endTime, r.subject, r.teacher]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 24 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Template global + contoh. */
export function buildTimetableAllTemplate(): Buffer {
  return buildTimetableAllWorkbook([
    { kelas: "X-IPA-1", dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Nama Guru" },
    { kelas: "X-IPA-1", dayOfWeek: 1, startTime: "07:45", endTime: "08:30", subject: "IPA", teacher: "Nama Guru" },
    { kelas: "X-IPA-2", dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subject: "Matematika", teacher: "Nama Guru" },
  ]);
}

/** Parse buffer .xlsx → baris valid + error per baris (tak pernah lempar). */
export function parseTimetableBuffer(buf: Buffer | Uint8Array): {
  rows: TimetableRowInput[];
  errors: TimetableParseError[];
} {
  const rows: TimetableRowInput[] = [];
  const errors: TimetableParseError[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return { rows, errors: [{ baris: 0, pesan: "file bukan .xlsx valid" }] };
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows, errors: [{ baris: 0, pesan: "sheet kosong" }] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  if (aoa.length === 0) return { rows, errors: [{ baris: 0, pesan: "sheet kosong" }] };
  // Cari baris header (cocok 5 kolom format sendiri, case-insensitive).
  const want = TIMETABLE_HEADER.map((h) => h.toLowerCase());
  let headIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cells = (aoa[i] as unknown[]).slice(0, 5).map((c) => normCell(c).toLowerCase());
    if (cells.length === 5 && cells.every((c, j) => c === want[j])) { headIdx = i; break; }
  }
  if (headIdx < 0) {
    return { rows, errors: [{ baris: 1, pesan: "header tak sesuai format: Hari|Mulai|Selesai|Mapel|Guru" }] };
  }
  for (let i = headIdx + 1; i < aoa.length; i++) {
    const cells = (aoa[i] as unknown[]).map(normCell);
    if (cells.every((c) => c === "")) continue; // baris kosong dilewati
    const baris = i + 1; // nomor baris Excel (1-based)
    const [hari, mulai, selesai, mapel, guru] = [cells[0] ?? "", cells[1] ?? "", cells[2] ?? "", cells[3] ?? "", cells[4] ?? ""];
    const day = parseDayLabel(hari);
    if (day === null) { errors.push({ baris, pesan: `hari tak dikenal: "${hari}"` }); continue; }
    if (!HHMM_RE.test(mulai)) { errors.push({ baris, pesan: `jam mulai tak valid (HH:MM): "${mulai}"` }); continue; }
    if (!HHMM_RE.test(selesai)) { errors.push({ baris, pesan: `jam selesai tak valid (HH:MM): "${selesai}"` }); continue; }
    if (!(selesai > mulai)) { errors.push({ baris, pesan: "jam selesai harus setelah jam mulai" }); continue; }
    if (!mapel) { errors.push({ baris, pesan: "mapel wajib diisi" }); continue; }
    rows.push({ dayOfWeek: day, startTime: mulai, endTime: selesai, subject: mapel, teacher: guru });
  }
  return { rows, errors };
}

/** Parse buffer .xlsx global all-kelas → baris valid (+nama kelas) + error per baris. */
export function parseTimetableAllBuffer(buf: Buffer | Uint8Array): {
  rows: TimetableAllRowInput[];
  errors: TimetableParseError[];
} {
  const rows: TimetableAllRowInput[] = [];
  const errors: TimetableParseError[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return { rows, errors: [{ baris: 0, pesan: "file bukan .xlsx valid" }] };
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows, errors: [{ baris: 0, pesan: "sheet kosong" }] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true });
  if (aoa.length === 0) return { rows, errors: [{ baris: 0, pesan: "sheet kosong" }] };
  const want = TIMETABLE_ALL_HEADER.map((h) => h.toLowerCase());
  let headIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const cells = (aoa[i] as unknown[]).slice(0, 6).map((c) => normCell(c).toLowerCase());
    if (cells.length === 6 && cells.every((c, j) => c === want[j])) { headIdx = i; break; }
  }
  if (headIdx < 0) {
    return { rows, errors: [{ baris: 1, pesan: "header tak sesuai format: Kelas|Hari|Mulai|Selesai|Mapel|Guru" }] };
  }
  for (let i = headIdx + 1; i < aoa.length; i++) {
    const cells = (aoa[i] as unknown[]).map(normCell);
    if (cells.every((c) => c === "")) continue;
    const baris = i + 1;
    const [kelas, hari, mulai, selesai, mapel, guru] = [cells[0] ?? "", cells[1] ?? "", cells[2] ?? "", cells[3] ?? "", cells[4] ?? "", cells[5] ?? ""];
    if (!kelas) { errors.push({ baris, pesan: "kelas wajib diisi" }); continue; }
    const day = parseDayLabel(hari);
    if (day === null) { errors.push({ baris, pesan: `hari tak dikenal: "${hari}"` }); continue; }
    if (!HHMM_RE.test(mulai)) { errors.push({ baris, pesan: `jam mulai tak valid (HH:MM): "${mulai}"` }); continue; }
    if (!HHMM_RE.test(selesai)) { errors.push({ baris, pesan: `jam selesai tak valid (HH:MM): "${selesai}"` }); continue; }
    if (!(selesai > mulai)) { errors.push({ baris, pesan: "jam selesai harus setelah jam mulai" }); continue; }
    if (!mapel) { errors.push({ baris, pesan: "mapel wajib diisi" }); continue; }
    rows.push({ kelas, dayOfWeek: day, startTime: mulai, endTime: selesai, subject: mapel, teacher: guru });
  }
  return { rows, errors };
}
