import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { purgeEdge } from "@/server/cf-purge";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { getRootSettings, ROOT_SETTINGS_TAG } from "@/lib/public-cache";

// GET /api/root/settings — SUPER_ADMIN: hero + meta platform dari RootSettings.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  // Di-cache 60 dtk dengan tag root-settings; PATCH di bawah menghapus cache.
  return NextResponse.json(await getRootSettings());
}

// PATCH /api/root/settings — ubah identitas platform.
export async function PATCH(req: NextRequest) {
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

  const body = (await req.json().catch(() => null)) as
    | { platformName?: unknown; platformTagline?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: "body tidak valid" }, { status: 400 });

  const pairs: [string, string][] = [];
  if (typeof body.platformName === "string") pairs.push(["platformName", body.platformName.trim().slice(0, 80)]);
  if (typeof body.platformTagline === "string")
    pairs.push(["platformTagline", body.platformTagline.trim().slice(0, 200)]);
  if (!pairs.length) return NextResponse.json({ error: "tidak ada perubahan" }, { status: 400 });

  const dbRoot = getRootDb();
  for (const [key, value] of pairs) {
    await dbRoot.$queryRaw`
      INSERT INTO "RootSettings" ("key", "value", "updatedAt")
      VALUES (${key}, to_jsonb(${value}::text), now())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`;
  }
  revalidateTag(ROOT_SETTINGS_TAG, { expire: 0 });
  await purgeEdge(["/beranda", "/privasi", "/syarat"]);
  return NextResponse.json({ ok: true });
}
