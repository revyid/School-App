import { createReadStream, promises as fsp } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicSchool } from "@/lib/public-cache";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
const SAFE = /^logos\/[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/portal/logo — PUBLIK per sekolah (scope slug dari host): serve logo
// yang diupload admin. Tanpa login; path dibatasi regex + root sekolah.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Identitas + logoUrl di-cache per slug (lib/public-cache).
  const school = await getPublicSchool(slug);
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const rel = school.logoUrl ?? "";
  if (!SAFE.test(rel)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const path = `${root()}/${school.id}/branding/${rel.slice("logos/".length)}`;
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
      "cache-control": "public, max-age=86400",
    },
  });
}
