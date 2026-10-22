import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { purgeEdge } from "@/server/cf-purge";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { MAX_LOGO_BYTES, saveBrandImage } from "@/server/images";
import { ROOT_SETTINGS_TAG } from "@/lib/public-cache";

// POST /api/root/settings/logo — upload logo platform (PNG/JPG/WEBP <=2MB).
export async function POST(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const form = await req.formData().catch(() => null);
  const saved = await saveBrandImage({
    file: form?.get("file"),
    dir: "branding",
    maxBytes: MAX_LOGO_BYTES,
    tooLargeStatus: 413,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });

  const dbRoot = getRootDb();
  await dbRoot.$queryRaw`
    INSERT INTO "RootSettings" ("key", "value", "updatedAt")
    VALUES ('platformLogoUrl', to_jsonb(${saved.relPath}::text), now())
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`;
  revalidateTag(ROOT_SETTINGS_TAG, { expire: 0 });
  await purgeEdge(["/beranda"]);
  return NextResponse.json({ url: "/api/portal/platform-logo" }, { status: 201 });
}
