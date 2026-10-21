import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@sms/db/root";
import { detectImage } from "@/server/images";

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
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_HERO_BYTES) return NextResponse.json({ error: "file melebihi 2MB" }, { status: 413 });
  const kind = detectImage(buf);
  if (!kind) return NextResponse.json({ error: "file bukan gambar PNG/JPG/WEBP valid" }, { status: 400 });

  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  const dir = `${root()}/.hero`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${name}`, buf);

  const url = `/api/root/settings/hero?f=${name}`;
  const dbRoot = getRootDb();
  await dbRoot.$queryRaw`UPDATE "RootSettings" SET value = to_jsonb(${url}::text), "updatedAt" = now() WHERE key = 'heroImageUrl'`;
  const alt = form?.get("alt");
  if (typeof alt === "string") {
    await dbRoot.$queryRaw`UPDATE "RootSettings" SET value = to_jsonb(${alt.slice(0, 200)}::text), "updatedAt" = now() WHERE key = 'heroAlt'`;
  }
  return NextResponse.json({ url }, { status: 201 });
}
