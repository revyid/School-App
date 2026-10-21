import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPortalInfo } from "@/lib/public-cache";

// GET /api/portal/info — publik (tanpa login): nama, lat/lng, CTA, pengumuman ALL.
// Data di-cache per slug (lib/public-cache) supaya tidak query Postgres tiap request.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const info = await getPortalInfo(slug);
  if (!info) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(info);
}
