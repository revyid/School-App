// Foto izin live-capture: /data/uploads/<schoolId>/leave/<leaveId|tmp>-<acak>.jpg.
// Hanya JPEG/PNG (dari kamera), maks 3MB. Jalan server-side dari buffer,
// BUKAN path mentah klien. Setiap akses baca dicatat audit di route.
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { MAX_LEAVE_PHOTO } from "@sms/shared/leave";

export function detectLeavePhoto(buf: Buffer): "jpg" | "png" | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  return null;
}

export async function saveLeavePhoto(
  schoolId: string,
  owner: string,
  buf: Buffer,
): Promise<string> {
  const kind = detectLeavePhoto(buf);
  if (!kind) throw new Error("foto harus JPEG/PNG asli dari kamera");
  if (buf.length > MAX_LEAVE_PHOTO) throw new Error("foto maksimal 3MB");
  const name = `${owner}-${randomBytes(8).toString("hex")}.${kind === "png" ? "png" : "jpg"}`;
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  const dir = path.join(root, schoolId, "leave");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return name;
}

export function leavePhotoPath(schoolId: string, name: string): string {
  const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
  const base = path.basename(name);
  if (base !== name || base.includes("..")) throw new Error("nama file tidak valid");
  const p = path.join(root, schoolId, "leave", base);
  if (!p.startsWith(path.join(root, schoolId))) throw new Error("path tidak valid");
  return p;
}

export async function deleteLeavePhoto(schoolId: string, name: string): Promise<void> {
  try {
    await unlink(leavePhotoPath(schoolId, name));
  } catch {
    // file sudah hilang -> anggap beres (idempotent)
  }
}
