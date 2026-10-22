import { createReadStream, promises as fsp } from "node:fs";
import { NextResponse } from "next/server";
import { getRootDb } from "@lacakedu/db/root";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
const SAFE = /^branding\/[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/portal/platform-logo — PUBLIK: serve logo platform yang diupload root.
// Path diambil dari RootSettings dan dibatasi regex + UPLOADS_ROOT.
export async function GET() {
  const rows = await getRootDb().$queryRaw<{ value: unknown }[]>`
    SELECT value FROM "RootSettings" WHERE key = 'platformLogoUrl' LIMIT 1`;
  const rel = rows[0]?.value;
  if (typeof rel !== "string" || !SAFE.test(rel))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const path = `${root()}/${rel}`;
  try {
    await fsp.access(path);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ext = rel.split(".").pop();
  const ct = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(createReadStream(path) as unknown as BodyInit, {
    headers: {
      "content-type": ct,
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=86400",
    },
  });
}
