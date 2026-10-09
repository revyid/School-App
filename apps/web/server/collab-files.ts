// Lampiran kolaborasi: /data/uploads/<schoolId>/collab/<threadId>-<acak>.<ext>.
// Teks/gambar/pdf, maks 5MB. Akses: pengirim, penerima tercantum, admin.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export const MAX_COLLAB_FILE = 5 * 1024 * 1024;

export function detectCollab(buf: Buffer): string | null {
  if (buf.length > MAX_COLLAB_FILE) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
  return null;
}

function dir(schoolId: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  return path.join(/*turbopackIgnore: true*/ root, schoolId, "collab");
}

export async function saveCollabFile(schoolId: string, threadId: string, buf: Buffer): Promise<string> {
  const ext = detectCollab(buf);
  if (!ext) throw new Error("lampiran harus jpg/png/pdf/zip (maks 5MB)");
  const name = `${threadId.slice(0, 12)}-${randomBytes(6).toString("hex")}.${ext}`;
  await mkdir(dir(schoolId), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ dir(schoolId), name), buf);
  return name;
}

export function collabFilePath(schoolId: string, name: string): string {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) throw new Error("nama file tidak valid");
  const p = path.join(/*turbopackIgnore: true*/ dir(schoolId), base);
  if (!p.startsWith(dir(schoolId))) throw new Error("path tidak valid");
  return p;
}

export async function deleteCollabFile(schoolId: string, name: string): Promise<void> {
  try {
    const { unlink: rm } = await import("node:fs/promises");
    await rm(collabFilePath(schoolId, name));
  } catch {
    // hilang = beres
  }
}
