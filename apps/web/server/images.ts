import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46]);
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function detectImage(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 4).equals(PNG)) return "png";
  if (buf.subarray(0, 3).equals(JPG)) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 4).equals(WEBP) && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

const uploadsRoot = () => process.env.UPLOADS_ROOT ?? "/data/uploads";

// Simpan gambar brand (hero/logo/avatar) dengan nama acak di <UPLOADS_ROOT>/[subDir/]dir.
export async function saveBrandImage(opts: {
  file: unknown;
  dir: string;
  subDir?: string;
  maxBytes: number;
  tooLargeStatus?: number;
}): Promise<{ name: string; relPath: string } | { error: string; status: number }> {
  if (!(opts.file instanceof File)) return { error: "file wajib diunggah", status: 400 };
  const buf = Buffer.from(await opts.file.arrayBuffer());
  if (buf.length > opts.maxBytes) {
    return { error: "file melebihi 2MB", status: opts.tooLargeStatus ?? 400 };
  }
  const kind = detectImage(buf);
  if (!kind) return { error: "file bukan gambar PNG/JPG/WEBP valid", status: 400 };
  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  const folder = opts.subDir ? `${opts.subDir}/${opts.dir}` : opts.dir;
  await mkdir(`${uploadsRoot()}/${folder}`, { recursive: true });
  await writeFile(`${uploadsRoot()}/${folder}/${name}`, buf);
  return { name, relPath: `${folder}/${name}` };
}
