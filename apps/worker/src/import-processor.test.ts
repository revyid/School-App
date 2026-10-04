import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { processImportBatch } from "./import-processor.js";

const UPLOADS = process.env.UPLOADS_ROOT ?? "/tmp/sms-uploads";
let schoolId = "";
let adminId = "";

function sheet(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  wb.SheetNames.push("Siswa");
  wb.Sheets["Siswa"] = XLSX.utils.json_to_sheet(rows);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

async function makeBatch(fileName: string): Promise<string> {
  const b = await runAsSchool(db, schoolId, (tx) =>
    tx.importBatch.create({ data: { schoolId, createdById: adminId, fileName } }));
  await mkdir(`${UPLOADS}/${schoolId}/imports`, { recursive: true });
  return b.id;
}

beforeAll(async () => {
  const t = Date.now().toString(36);
  schoolId = (await dbSystem.school.create({ data: { slug: `imp-${t}`, name: "IMP" } })).id;
  adminId = (await dbSystem.user.create({
    data: { schoolId, role: "ADMIN", email: `adm-${t}@t.id`, name: "ADM", passwordHash: "x" },
  })).id;
  await runAsSchool(db, schoolId, (tx) =>
    tx.schoolSettings.create({ data: { schoolId, defaultPasswordMode: "nisn" } }));
});
afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: schoolId } });
});

describe("import processor", () => {
  it("valid: 2 siswa dibuat + kredensial NISN-derived", async () => {
    const id = await makeBatch("valid.xlsx");
    await writeFile(`${UPLOADS}/${schoolId}/imports/${id}.xlsx`, sheet([
      { Nama: "Satu", JK: "L", NISN: "1000000001", "Tgl Lahir": "2012-01-01", Kelas: "VII-A", "No Ortu": "081200000001" },
      { Nama: "Dua", JK: "P", NISN: "1000000002", "Tgl Lahir": "2012-02-02", Kelas: "VII-A", "No Ortu": "081200000002" },
    ]));
    await processImportBatch(schoolId, id, `${UPLOADS}/${schoolId}/imports/${id}.xlsx`);
    const batch = await runAsSchool(db, schoolId, (tx) => tx.importBatch.findUniqueOrThrow({ where: { id } }));
    expect(batch.status).toBe("DONE");
    expect(batch.okRows).toBe(2);
    expect(batch.errRows).toBe(0);
    const report = batch.errorReport as unknown as { credentials: { nisn: string; password: string }[] };
    expect(report.credentials.map((c) => c.nisn).sort()).toEqual(["1000000001", "1000000002"]);
    expect(report.credentials[0].password).toBe(report.credentials[0].nisn); // mode nisn
    const count = await runAsSchool(db, schoolId, (tx) => tx.user.count({ where: { role: "SISWA" } }));
    expect(count).toBe(2);
  });

  it("rerun idempotent: tidak membuat user ganda", async () => {
    const id = await makeBatch("dupe.xlsx");
    await writeFile(`${UPLOADS}/${schoolId}/imports/${id}.xlsx`, sheet([
      { Nama: "Satu X", JK: "L", NISN: "1000000001", Kelas: "VII-A" },
    ]));
    await processImportBatch(schoolId, id, `${UPLOADS}/${schoolId}/imports/${id}.xlsx`);
    const count = await runAsSchool(db, schoolId, (tx) => tx.user.count({ where: { role: "SISWA" } }));
    expect(count).toBe(2); // tetap, upsert by NISN
    const u = await runAsSchool(db, schoolId, (tx) =>
      tx.user.findUniqueOrThrow({ where: { schoolId_nisn: { schoolId, nisn: "1000000001" } } }));
    expect(u.name).toBe("Satu X"); // nama ter-update
  });

  it("rusak: baris error dilaporkan, baris valid tetap masuk", async () => {
    const id = await makeBatch("partial.xlsx");
    await writeFile(`${UPLOADS}/${schoolId}/imports/${id}.xlsx`, sheet([
      { Nama: "", JK: "X", NISN: "ab", Kelas: "" },
      { Nama: "Tiga", JK: "L", NISN: "1000000003", Kelas: "VII-B", "No Ortu": "081200000003" },
    ]));
    await processImportBatch(schoolId, id, `${UPLOADS}/${schoolId}/imports/${id}.xlsx`);
    const batch = await runAsSchool(db, schoolId, (tx) => tx.importBatch.findUniqueOrThrow({ where: { id } }));
    expect(batch.status).toBe("DONE");
    expect(batch.okRows).toBe(1);
    expect(batch.errRows).toBe(1);
    const report = batch.errorReport as unknown as { rowErrors: { rowNumber: number; errors: string[] }[] };
    expect(report.rowErrors[0].rowNumber).toBe(2);
    expect(report.rowErrors[0].errors.length).toBeGreaterThanOrEqual(3);
  });
});
