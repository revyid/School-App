import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";

const uploadsRoot = () => process.env.UPLOADS_ROOT ?? "/data/uploads";

// Magic bytes (bukan ekstensi). xlsx = ZIP container -> cek 'PK\x03\x04'.
const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function isXlsxBuffer(buf: Buffer): boolean {
  return buf.length > 4 && buf.subarray(0, 4).equals(XLSX_MAGIC);
}

export async function saveImportFile(schoolId: string, batchId: string, buf: Buffer): Promise<string> {
  if (buf.length > MAX_IMPORT_BYTES) throw new Error("file melebihi 10MB");
  if (!isXlsxBuffer(buf)) throw new Error("file bukan .xlsx valid (magic bytes tidak cocok)");
  const path = `${uploadsRoot()}/${schoolId}/imports/${batchId}.xlsx`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
  return path;
}

export async function removeImportFile(schoolId: string, batchId: string): Promise<void> {
  await unlink(`${uploadsRoot()}/${schoolId}/imports/${batchId}.xlsx`).catch(() => {});
}
