import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicSchool } from "@/lib/public-cache";

const SAFE = /^[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/books/cover?f=<nama> —PUBLIK per sekolah (scope dari host):
// serve sampul buku yang diunggah admin sekolah.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await getPublicSchool(slug);
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });

  const f = (new URL(req.url).searchParams.get("f") ?? "").trim();
  if (!SAFE.test(f)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const filePath = path.join(process.env.UPLOADS_ROOT ?? "/data/uploads", school.id, "books", "covers", f);
  try {
    await fsp.access(filePath);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ext = f.split(".").pop();
  const ct = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(createReadStream(filePath) as unknown as BodyInit, {
    headers: {
      "content-type": ct,
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=86400",
    },
  });
}
