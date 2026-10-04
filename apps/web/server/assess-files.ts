// Gambar soal/jawaban: /data/uploads/<schoolId>/assess/<assessQId|bank>-<acak>.jpg|png.
// JPEG/PNG asli, maks 5MB. Nama file acak; akses via /api/assess-files (otorisasi peran).
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export const MAX_ASSESS_IMG = 5 * 1024 * 1024;

export function detectAssessImg(buf: Buffer): "jpg" | "png" | null {
  if (buf.length > MAX_ASSESS_IMG) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  return null;
}

function dir(schoolId: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  return path.join(root, schoolId, "assess");
}

export async function saveAssessImg(schoolId: string, buf: Buffer): Promise<string> {
  const ext = detectAssessImg(buf);
  if (!ext) throw new Error("gambar harus JPEG/PNG asli (maks 5MB)");
  const name = `q-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(dir(schoolId), { recursive: true });
  await writeFile(path.join(dir(schoolId), name), buf);
  return name;
}

export async function deleteAssessImg(schoolId: string, name: string): Promise<void> {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) return;
  const p = path.join(dir(schoolId), base);
  if (!p.startsWith(dir(schoolId))) return;
  try {
    await unlink(p);
  } catch {
    // hilang = beres
  }
}

export function assessImgPath(schoolId: string, name: string): string {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) throw new Error("nama file tidak valid");
  const p = path.join(dir(schoolId), base);
  if (!p.startsWith(dir(schoolId))) throw new Error("path tidak valid");
  return p;
}
