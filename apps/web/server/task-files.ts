// Penyimpanan file tugas/submission: /data/uploads/<schoolId>/tasks/<taskId>/<acak>-<nama>.
// Magic bytes: pdf/png/jpg/webp/zip(docx/xlsx/pptx)/mp4; batas 10MB.
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const MAX_TASK_FILE = 10 * 1024 * 1024;

function magicKind(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 12 && buf.toString("ascii", 8, 12) === "WEBP" && buf.toString("ascii", 0, 4) === "RIFF") return "webp";
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "zip"; // docx/xlsx/pptx
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "mp4";
  return null;
}

export function detectTaskFile(buf: Buffer): "pdf" | "png" | "jpg" | "webp" | "zip" | "mp4" | null {
  const k = magicKind(buf);
  return k === "pdf" || k === "png" || k === "jpg" || k === "webp" || k === "zip" || k === "mp4" ? k : null;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  zip: "application/octet-stream",
  mp4: "video/mp4",
};

export async function saveTaskFile(
  schoolId: string,
  taskId: string,
  original: string,
  buf: Buffer,
): Promise<{ fileName: string; mime: string; size: number }> {
  const kind = detectTaskFile(buf);
  if (!kind) throw new Error("tipe file tidak didukung");
  if (buf.length > MAX_TASK_FILE) throw new Error("file maksimal 10MB");
  const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  const fileName = `${randomBytes(8).toString("hex")}-${safe}`;
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  const dir = path.join(root, schoolId, "tasks", taskId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buf);
  return { fileName, mime: MIME[kind], size: buf.length };
}

export function taskFilePath(schoolId: string, taskId: string, fileName: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  const p = path.join(root, schoolId, "tasks", taskId, path.basename(fileName));
  if (!p.startsWith(path.join(root, schoolId))) throw new Error("path tidak valid");
  return p;
}
