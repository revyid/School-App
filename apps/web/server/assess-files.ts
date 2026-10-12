// Gambar soal/jawaban: /data/uploads/<schoolId>/assess/<assessQId|bank>-<acak>.jpg|png.
// JPEG/PNG asli, maks 5MB. Nama file acak; akses via /api/assess-files (otorisasi peran).
// Video soal: mp4/webm asli, maks 20MB (nama qv-...).
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export const MAX_ASSESS_IMG = 5 * 1024 * 1024;
export const MAX_ASSESS_VIDEO = 20 * 1024 * 1024;

export function detectAssessImg(buf: Buffer): "jpg" | "png" | null {
  if (buf.length > MAX_ASSESS_IMG) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  return null;
}

export function detectAssessVideo(buf: Buffer): "mp4" | "webm" | null {
  if (buf.length > MAX_ASSESS_VIDEO) return null;
  // mp4: ....ftyp | webm: 0x1A 0x45 0xDF 0xA3
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "mp4";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

function dir(schoolId: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  return path.join(/*turbopackIgnore: true*/ root, schoolId, "assess");
}

export async function saveAssessImg(schoolId: string, buf: Buffer): Promise<string> {
  const ext = detectAssessImg(buf);
  if (!ext) throw new Error("gambar harus JPEG/PNG asli (maks 5MB)");
  const name = `q-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(dir(schoolId), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ dir(schoolId), name), buf);
  return name;
}

export async function saveAssessVideo(schoolId: string, buf: Buffer): Promise<string> {
  const ext = detectAssessVideo(buf);
  if (!ext) throw new Error("video harus MP4/WebM asli (maks 20MB)");
  const name = `qv-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(dir(schoolId), { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ dir(schoolId), name), buf);
  return name;
}

export async function deleteAssessImg(schoolId: string, name: string): Promise<void> {
  const base = path.basename(name);
  if (base !== name || base.includes("..")) return;
  const p = path.join(/*turbopackIgnore: true*/ dir(schoolId), base);
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
  const p = path.join(/*turbopackIgnore: true*/ dir(schoolId), base);
  if (!p.startsWith(dir(schoolId))) throw new Error("path tidak valid");
  return p;
}
