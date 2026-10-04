// Processor import Excel siswa. Idempotent: rerun batch DONE dilewati,
// upsert by NISN sehingga baris duplikat tidak membuat user ganda.
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { validateImportRow, type ImportRowOk } from "@sms/shared/master";

const CHUNK = 50;
const TX_OPTS = { timeout: 120_000, maxWait: 15_000 };

export interface Credential {
  nisn: string;
  name: string;
  password: string;
}

function randomPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function processImportBatch(schoolId: string, batchId: string, filePath: string): Promise<void> {
  const meta = await runAsSchool(db, schoolId, (tx) =>
    tx.importBatch.findUnique({ where: { id: batchId } }),
  );
  if (!meta || meta.schoolId !== schoolId) throw new Error("batch tidak ditemukan");
  if (meta.status === "DONE") return; // idempotent
  await runAsSchool(db, schoolId, (tx) =>
    tx.importBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } }),
  );

  const buf = await readFile(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("file tidak berisi sheet");
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const totalRows = rawRows.length;

  const rowErrors: { rowNumber: number; errors: string[] }[] = [];
  const valid: { row: ImportRowOk; rowNumber: number }[] = [];
  rawRows.forEach((r, i) => {
    const v = validateImportRow(
      {
        Nama: r["Nama"],
        JK: r["JK"],
        NISN: r["NISN"],
        "Tgl Lahir": r["Tgl Lahir"],
        Kelas: r["Kelas"],
        "No Ortu": r["No Ortu"],
      },
      i + 2,
    );
    if (v.ok) valid.push({ row: v, rowNumber: i + 2 });
    else rowErrors.push({ rowNumber: v.rowNumber, errors: v.errors });
  });

  const settings = await runAsSchool(db, schoolId, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId } }),
  );
  const pwMode = settings?.defaultPasswordMode === "nisn" ? "nisn" : "random";

  const credentials: Credential[] = [];
  let okRows = 0;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const chunkCreds: Credential[] = [];
    await runAsSchool(
      db,
      schoolId,
      async (tx) => {
        for (const { row } of chunk) {
          let cls = await tx.class.findUnique({
            where: { schoolId_name: { schoolId, name: row.className } },
          });
          if (!cls) {
            cls = await tx.class.create({ data: { schoolId, name: row.className } });
          }
          const existing = await tx.user.findUnique({
            where: { schoolId_nisn: { schoolId, nisn: row.nisn } },
          });
          if (existing) {
            await tx.user.update({ where: { id: existing.id }, data: { name: row.name, isActive: true } });
            await tx.studentProfile.upsert({
              where: { userId: existing.id },
              update: {
                classId: cls.id,
                gender: row.gender,
                birthDate: row.birthDate,
                parentPhone: row.parentPhone,
              },
              create: {
                schoolId,
                userId: existing.id,
                classId: cls.id,
                gender: row.gender,
                birthDate: row.birthDate,
                parentPhone: row.parentPhone,
              },
            });
          } else {
            const password = pwMode === "nisn" ? row.nisn : randomPassword();
            const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
            const user = await tx.user.create({
              data: {
                schoolId,
                role: "SISWA",
                nisn: row.nisn,
                name: row.name,
                passwordHash,
                mustChangePassword: true,
                passwordChangedAt: new Date(),
              },
            });
            await tx.studentProfile.create({
              data: {
                schoolId,
                userId: user.id,
                classId: cls.id,
                gender: row.gender,
                birthDate: row.birthDate,
                parentPhone: row.parentPhone,
              },
            });
            chunkCreds.push({ nisn: row.nisn, name: row.name, password });
          }
          okRows++;
        }
      },
      TX_OPTS,
    );
    credentials.push(...chunkCreds);
    await runAsSchool(db, schoolId, (tx) =>
      tx.importBatch.update({
        where: { id: batchId },
        data: { processedRows: Math.min(i + CHUNK, valid.length) + rowErrors.length, okRows },
      }),
    );
  }

  const report = JSON.parse(JSON.stringify({ rowErrors, credentials, credentialsDownloaded: false }));
  await runAsSchool(db, schoolId, (tx) =>
    tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: "DONE",
        totalRows,
        processedRows: totalRows,
        okRows,
        errRows: rowErrors.length,
        errorReport: report,
      },
    }),
  );
}
