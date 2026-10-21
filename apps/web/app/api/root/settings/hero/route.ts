import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { purgeEdge } from "@/server/cf-purge";
import { readFile } from "node:fs/promises";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { saveBrandImage } from "@/server/images";
import { ROOT_SETTINGS_TAG } from "@/lib/public-cache";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
const MAX_HERO_BYTES = 2 * 1024 * 1024;
const SAFE = /^[a-f0-9]{32}\.(png|jpg|webp)$/;

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
}

// GET /api/root/settings/hero?f=<nama> — serve byte hero yang tersimpan.
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const name = new URL(req.url).searchParams.get("f") ?? "";
  if (!SAFE.test(name)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let buf: Buffer;
  try {
    buf = await readFile(`${root()}/.hero/${name}`);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const ct = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "content-type": ct,
      "content-disposition": `inline; filename="${name}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=86400",
    },
  });
}

// POST /api/root/settings/hero — upload hero (PNG/JPG/WEBP <=2MB).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const form = await req.formData().catch(() => null);
  const saved = await saveBrandImage({
    file: form?.get("file"),
    dir: ".hero",
    maxBytes: MAX_HERO_BYTES,
    tooLargeStatus: 413,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });
  const { name } = saved;

  const url = `/api/root/settings/hero?f=${name}`;
  const dbRoot = getRootDb();
  await dbRoot.$queryRaw`UPDATE "RootSettings" SET value = to_jsonb(${url}::text), "updatedAt" = now() WHERE key = 'heroImageUrl'`;
  const alt = form?.get("alt");
  if (typeof alt === "string") {
    await dbRoot.$queryRaw`UPDATE "RootSettings" SET value = to_jsonb(${alt.slice(0, 200)}::text), "updatedAt" = now() WHERE key = 'heroAlt'`;
  }
  revalidateTag(ROOT_SETTINGS_TAG, { expire: 0 });
  await purgeEdge(["/beranda", "/privasi", "/syarat"]);
  return NextResponse.json({ url }, { status: 201 });
}
