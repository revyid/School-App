import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { purgeEdge } from "@/server/cf-purge";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { getRootSettings, ROOT_SETTINGS_TAG } from "@/lib/public-cache";

const featureFlagsSchema = z.object({
  aiChat: z.boolean().optional(),
  waBroadcast: z.boolean().optional(),
  ebook: z.boolean().optional(),
  qrAttendance: z.boolean().optional(),
  studentImport: z.boolean().optional(),
});

const bodySchema = z.object({
  platformName: z.string().trim().max(128).optional(),
  platformTagline: z.string().trim().max(200).optional(),
  platformLogoUrl: z.string().trim().max(255).nullable().optional(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  supportEmail: z.string().trim().email().max(255).nullable().optional(),
  featureFlags: featureFlagsSchema.optional(),
});

type ExtraSettings = {
  platformLogoUrl: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  featureFlags: z.infer<typeof featureFlagsSchema>;
};

// Key di luar cache getRootSettings (lib/public-cache) dibaca langsung.
async function readExtra(): Promise<ExtraSettings> {
  const rows = await getRootDb().$queryRaw<{ key: string; value: unknown }[]>`
    SELECT key, value FROM "RootSettings"
    WHERE key IN ('platformLogoUrl', 'primaryColor', 'supportEmail', 'featureFlags')`;
  const val = (key: string) => {
    const v = rows.find((r) => r.key === key)?.value;
    return typeof v === "string" ? v : "";
  };
  const ff = rows.find((r) => r.key === "featureFlags")?.value;
  const parsed = featureFlagsSchema.safeParse(ff);
  return {
    platformLogoUrl: val("platformLogoUrl") || null,
    primaryColor: val("primaryColor") || null,
    supportEmail: val("supportEmail") || null,
    featureFlags: parsed.success ? parsed.data : {},
  };
}

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
  return NextResponse.json({ ...(await getRootSettings()), ...(await readExtra()) });
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

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join(".") || "body"}: ${first.message}` : "body tidak valid" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const pairs: [string, string][] = [];
  if (body.platformName !== undefined) pairs.push(["platformName", body.platformName]);
  if (body.platformTagline !== undefined) pairs.push(["platformTagline", body.platformTagline]);
  if (body.platformLogoUrl !== undefined) pairs.push(["platformLogoUrl", body.platformLogoUrl ?? ""]);
  if (body.primaryColor !== undefined) pairs.push(["primaryColor", body.primaryColor ?? ""]);
  if (body.supportEmail !== undefined) pairs.push(["supportEmail", body.supportEmail ?? ""]);
  if (!pairs.length && body.featureFlags === undefined)
    return NextResponse.json({ error: "tidak ada perubahan" }, { status: 400 });

  const dbRoot = getRootDb();
  for (const [key, value] of pairs) {
    // Upsert: key baru belum tentu punya baris di RootSettings.
    await dbRoot.$queryRaw`
      INSERT INTO "RootSettings" ("key", "value", "updatedAt")
      VALUES (${key}, to_jsonb(${value}::text), now())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`;
  }
  if (body.featureFlags !== undefined) {
    await dbRoot.$queryRaw`
      INSERT INTO "RootSettings" ("key", "value", "updatedAt")
      VALUES ('featureFlags', to_jsonb(${JSON.stringify(body.featureFlags)}::jsonb), now())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = now()`;
  }
  revalidateTag(ROOT_SETTINGS_TAG, { expire: 0 });
  await purgeEdge(["/beranda", "/privasi", "/syarat"]);
  return NextResponse.json({ ok: true });
}
