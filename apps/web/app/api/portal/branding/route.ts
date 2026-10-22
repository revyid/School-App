import { createReadStream, promises as fsp } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicSchool } from "@/lib/public-cache";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
// Hanya nama file hex32 + ekstensi gambar yang boleh (anti path traversal).
const SAFE = /^branding\/[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/portal/branding?kind=character|banner|hero — PUBLIK per sekolah:
// serve gambar karakter/banner/hero sekolah. Tanpa login; path dibatasi regex.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const kind = (new URL(req.url).searchParams.get("kind") ?? "character").trim();
  const field =
    kind === "banner" ? "dashboardBannerUrl" : kind === "hero" ? "heroImageUrl" : "characterImageUrl";

  const school = await getPublicSchool(slug);
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rel = school.branding?.[field] ?? "";
  if (!SAFE.test(rel)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const path = `${root()}/${school.id}/${rel}`;
  try {
    await fsp.access(path);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = createReadStream(path);
  const ext = rel.split(".").pop();
  const ct = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "content-type": ct,
      "x-content-type-options": "nosniff",
      "cache-control": "public, max-age=3600",
    },
  });
}
