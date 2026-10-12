// F6: SATU modul penyimpanan & penyajian file — streaming, magic-bytes,
// batas per tipe dari env (D6), penghapusan file lama saat diganti.
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import path from "node:path";

export const uploadsRoot = () => process.env.UPLOADS_ROOT ?? "/data/uploads";

// D6: batas per tipe (byte), bisa dioverride env.
const MB = 1024 * 1024;
export const LIMITS = {
  image: Number(process.env.UPLOAD_MAX_IMAGE_MB ?? 10) * MB,
  pdf: Number(process.env.UPLOAD_MAX_PDF_MB ?? 10) * MB,
  doc: Number(process.env.UPLOAD_MAX_DOC_MB ?? 10) * MB,
  videoMaterial: Number(process.env.UPLOAD_MAX_VIDEO_MATERIAL_MB ?? 50) * MB,
  videoAnswer: Number(process.env.UPLOAD_MAX_VIDEO_ANSWER_MB ?? 30) * MB,
  videoQuestion: Number(process.env.UPLOAD_MAX_VIDEO_QUESTION_MB ?? 50) * MB,
};

export type FileKind = "pdf" | "png" | "jpg" | "webp" | "zip" | "mp4" | "webm" | "gif";

// Magic bytes (bukan ekstensi). zip = docx/xlsx/pptx (ZIP container).
export function detectFileKind(buf: Buffer): FileKind | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "zip";
  if (buf.length >= 8 && buf.toString("ascii", 4, 8) === "ftyp") return "mp4";
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";
  return null;
}

export const MIME: Record<FileKind, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/octet-stream",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function extOf(kind: FileKind): string {
  return { pdf: "pdf", png: "png", jpg: "jpg", gif: "gif", webp: "webp", zip: "zip", mp4: "mp4", webm: "webm" }[kind];
}

/** Batas ukuran menurut maksud pemakaian (D6). */
export function limitFor(purpose: "image" | "pdf" | "doc" | "video-material" | "video-answer" | "video-question"): number {
  switch (purpose) {
    case "image": return LIMITS.image;
    case "pdf": return LIMITS.pdf;
    case "doc": return LIMITS.doc;
    case "video-material": return LIMITS.videoMaterial;
    case "video-answer": return LIMITS.videoAnswer;
    case "video-question": return LIMITS.videoQuestion;
  }
}

/** Kategori file yang cocok untuk sebuah kind. */
export function kindsAllowed(purpose: "image" | "pdf" | "doc" | "video-material" | "video-answer" | "video-question"): FileKind[] {
  switch (purpose) {
    case "image": return ["png", "jpg", "webp", "gif"];
    case "pdf": return ["pdf"];
    case "doc": return ["zip"]; // zip container = docx/xlsx/pptx
    case "video-material":
    case "video-question":
    case "video-answer": return ["mp4", "webm"];
  }
}

export interface SavedFile {
  fileName: string;
  mime: string;
  size: number;
}

/**
 * Simpan file dari Web stream ke disk SECARA STREAMING (tanpa arrayBuffer penuh —
 * aman untuk video besar). Batas ditegakkan sambil menulis.
 */
export async function saveFileStream(
  relDir: string[],
  input: ReadableStream<Uint8Array> | File | Blob,
  purpose: "image" | "pdf" | "doc" | "video-material" | "video-answer" | "video-question",
  originalName: string,
): Promise<SavedFile> {
  const limit = limitFor(purpose);
  const allowed = kindsAllowed(purpose);
  const dir = path.join(uploadsRoot(), ...relDir);
  await mkdir(dir, { recursive: true });

  const safe = (originalName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fileName = `${randomBytes(8).toString("hex")}-${safe}`;
  const target = path.join(dir, fileName);

  const reader = input instanceof ReadableStream ? input.getReader() : input.stream().getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  let kind: FileKind | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    if (total === 0) {
      kind = detectFileKind(chunk);
      if (!kind || !allowed.includes(kind)) {
        await reader.cancel().catch(() => {});
        throw new Error("tipe file tidak didukung");
      }
    }
    total += chunk.length;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new Error(`file maksimal ${Math.round(limit / MB)}MB`);
    }
    chunks.push(chunk);
    // Stream tulis bertahap: tulis tiap ~8MB agar memori tetap rendah.
    if (total >= 8 * MB) {
      await writeFile(target, Buffer.concat(chunks.splice(0)));
    }
  }
  if (total === 0) throw new Error("file kosong");
  if (!kind) throw new Error("tipe file tidak didukung");
  // Sisa chunk: append atau tulis baru.
  const rest = Buffer.concat(chunks);
  const exists = await stat(target).then(() => true, () => false);
  if (exists && rest.length) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(target, rest);
  } else if (rest.length) {
    await writeFile(target, rest);
  }
  return { fileName, mime: MIME[kind], size: total };
}

/** Simpan dari Buffer (untuk file kecil / kode lama). */
export async function saveFileBuffer(
  relDir: string[],
  buf: Buffer,
  purpose: "image" | "pdf" | "doc" | "video-material" | "video-answer" | "video-question",
  originalName: string,
): Promise<SavedFile> {
  const limit = limitFor(purpose);
  const allowed = kindsAllowed(purpose);
  const kind = detectFileKind(buf);
  if (!kind || !allowed.includes(kind)) throw new Error("tipe file tidak didukung");
  if (buf.length > limit) throw new Error(`file maksimal ${Math.round(limit / MB)}MB`);
  const dir = path.join(uploadsRoot(), ...relDir);
  await mkdir(dir, { recursive: true });
  const safe = (originalName || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fileName = `${randomBytes(8).toString("hex")}-${safe}`;
  await writeFile(path.join(dir, fileName), buf);
  return { fileName, mime: MIME[kind], size: buf.length };
}

/** Path absolut aman (anti path-traversal) untuk file dalam relDir. */
export function safeFilePath(relDir: string[], fileName: string): string {
  const p = path.join(uploadsRoot(), ...relDir, path.basename(fileName));
  const base = path.join(uploadsRoot(), ...relDir);
  if (!p.startsWith(base + path.sep)) throw new Error("path tidak valid");
  return p;
}

/** Hapus file bila ada (diam-diam). Dipanggil saat diganti/dihapus (B7). */
export async function removeFile(relDir: string[], fileName?: string | null): Promise<void> {
  if (!fileName) return;
  await unlink(safeFilePath(relDir, fileName)).catch(() => {});
}

export interface ServeOptions {
  /** true → Content-Disposition: inline (pdf/gambar/video bila ?inline=1). */
  inline?: boolean;
  downloadName?: string;
}

/**
 * Sajikan file dengan HTTP Range (206) + Accept-Ranges + EAG + nosniff.
 * Ini yang membuat video bisa di-seek di Chrome & Safari/iOS.
 */
export async function serveFile(
  relDir: string[],
  fileName: string,
  rangeHeader: string | null,
  opts: ServeOptions = {},
): Promise<Response> {
  let filePath: string;
  try {
    filePath = safeFilePath(relDir, fileName);
  } catch {
    return new Response("not found", { status: 404 });
  }
  let st: Awaited<ReturnType<typeof stat>>;
  try {
    st = await stat(filePath);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!st.isFile()) return new Response("not found", { status: 404 });

  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  const mime = (Object.entries(MIME).find(([k]) => extOf(k as FileKind) === ext)?.[1]) ?? "application/octet-stream";
  const etag = `"${st.size}-${st.mtimeMs.toString(36)}"`;
  const inlineable = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "mp4", "webm"].includes(ext);
  const disposition =
    opts.inline && inlineable
      ? `inline; filename="${(opts.downloadName ?? path.basename(fileName)).replace(/["\\]/g, "")}"`
      : `attachment; filename="${(opts.downloadName ?? path.basename(fileName)).replace(/["\\]/g, "")}"`;

  const baseHeaders: Record<string, string> = {
    "content-type": mime,
    "accept-ranges": "bytes",
    etag,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=0, must-revalidate",
    "content-disposition": disposition,
  };

  // Range parsing: bytes=start-end | bytes=start- | bytes=-suffix
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      const size = st.size;
      let start: number;
      let end: number;
      if (m[1] === "") {
        const suffix = Number(m[2]);
        start = Math.max(0, size - suffix);
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
      }
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
      }
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "content-range": `bytes ${start}-${end}/${size}`,
          "content-length": String(end - start + 1),
        },
      });
    }
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "content-length": String(st.size) },
  });
}
