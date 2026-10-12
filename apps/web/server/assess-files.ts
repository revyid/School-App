// Gambar soal/jawaban: /data/uploads/<schoolId>/assess/<acak>.jpg|png.
// JPEG/PNG asli, maks 5MB. Nama file acak; akses via /api/assess-files (otorisasi peran).
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_ASSESS_IMG = 5 * 1024 * 1024;
const ASSESS_IMG_NAME = /^q-[a-f0-9]{16}\.(?:jpg|png)$/;

export function detectAssessImg(buf: Buffer): "jpg" | "png" | null {
  if (buf.length > MAX_ASSESS_IMG) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  return null;
}

function dir(schoolId: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  return path.join(/*turbopackIgnore: true*/ root, schoolId, "assess");
}

function ownerPath(schoolId: string, name: string): string {
  return `${assessImgPath(schoolId, name)}.owner`;
}

export async function saveAssessImg(schoolId: string, buf: Buffer, ownerId?: string): Promise<string> {
  const ext = detectAssessImg(buf);
  if (!ext) throw new Error("gambar harus JPEG/PNG asli (maks 5MB)");
  const name = `q-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(dir(schoolId), { recursive: true });
  const target = assessImgPath(schoolId, name);
  await writeFile(target, buf, { flag: "wx" });
  if (ownerId) {
    try {
      await writeFile(ownerPath(schoolId, name), ownerId, { flag: "wx", mode: 0o600 });
    } catch (error) {
      await unlink(target).catch(() => {});
      throw error;
    }
  }
  return name;
}

export async function assessImgOwnedBy(schoolId: string, name: string, ownerId: string): Promise<boolean> {
  if (!ASSESS_IMG_NAME.test(name) || !ownerId) return false;
  try {
    const [owner] = await Promise.all([
      readFile(ownerPath(schoolId, name), "utf8"),
      readFile(assessImgPath(schoolId, name)),
    ]);
    return owner === ownerId;
  } catch {
    return false;
  }
}

export async function deleteAssessImg(schoolId: string, name: string): Promise<void> {
  if (!ASSESS_IMG_NAME.test(name)) return;
  const p = assessImgPath(schoolId, name);
  await Promise.all([unlink(p).catch(() => {}), unlink(`${p}.owner`).catch(() => {})]);
}

export function assessImgPath(schoolId: string, name: string): string {
  if (!ASSESS_IMG_NAME.test(name) || path.basename(name) !== name) throw new Error("nama file tidak valid");
  const p = path.join(/*turbopackIgnore: true*/ dir(schoolId), name);
  if (!p.startsWith(dir(schoolId) + path.sep)) throw new Error("path tidak valid");
  return p;
}
