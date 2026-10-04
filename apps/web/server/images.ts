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
