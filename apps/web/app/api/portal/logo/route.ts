import { createReadStream, promises as fsp } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { schoolSlugFromHost } from "@sms/shared/school";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
const SAFE = /^logos\/[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/portal/logo — PUBLIK per sekolah (scope slug dari host): serve logo
// yang diupload admin. Tanpa login; path dibatasi regex + root sekolah.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const s = await runAsSchool(db, school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: school.id }, select: { logoUrl: true } }));
  const rel = s?.logoUrl ?? "";
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
