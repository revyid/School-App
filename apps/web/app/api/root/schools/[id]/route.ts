import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { rootSchoolSettingsSchema } from "@lacakedu/shared/master";
import { schoolTag } from "@/lib/public-cache";
import { purgeEdge } from "@/server/cf-purge";

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

// Field yang boleh ditulis root. Root TIDAK boleh menulis field lain
// (mis. id, schoolId, expRules) walau(body valid.
const EDITABLE = [
  "portalName",
  "characterImageUrl",
  "heroImageUrl",
  "dashboardBannerUrl",
  "brandColor",
  "portalTheme",
  "startTime",
  "cutoffTime",
  "waDailyCap",
  "waPerMinuteCap",
  "ctaGtkUrl",
  "ctaMuridUrl",
  "studentRetentionDays",
  "photoRetentionDays",
  "defaultPasswordMode",
  "aiChatEnabled",
  "aiShareStudentData",
  "timezone",
  "ttsPhrase",
  "ttsPhraseDup",
  "mapLat",
  "mapLng",
] as const;

// GET /api/root/schools/[id] — SUPER_ADMIN: detail sekolah + setelannya.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const root = getRootDb();
  const school = await root.school.findUnique({
    where: { id },
    include: { settings: true },
  });
  if (!school) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    school: {
      id: school.id,
      slug: school.slug,
      name: school.name,
      lat: school.lat,
      lng: school.lng,
      logoUrl: school.logoUrl,
      settings: school.settings ?? null,
    },
  });
}

// PATCH /api/root/schools/[id] — SUPER_ADMIN: ubah setelan sekolah mana pun.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const root = getRootDb();
  const school = await root.school.findUnique({ where: { id }, select: { id: true, slug: true, name: true } });
  if (!school) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });

  const parsed = rootSchoolSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  // Allowlist: hanya field yang_diizinkan yang diteruskan.
  const picked: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in parsed.data) picked[k] = parsed.data[k];
  const { mapLat, mapLng, ...settings } = picked;

  if (Object.keys(settings).length > 0) {
    // Tulis lewat RLS tenant (schoolId benar-benar milik sekolah tsb).
    await runAsSchool(db, school.id, (tx) =>
      tx.schoolSettings.upsert({
        where: { schoolId: school.id },
        update: settings,
        create: { schoolId: school.id, ...settings },
      }),
    );
  }
  if (mapLat !== undefined || mapLng !== undefined) {
    await root.school.update({
      where: { id: school.id },
      data: {
        ...(mapLat !== undefined ? { lat: mapLat } : {}),
        ...(mapLng !== undefined ? { lng: mapLng } : {}),
      },
    });
  }

  await logAuth(school.id, "ROOT.SCHOOL_SETTINGS_UPDATE", {
    actorId: a.userId,
    meta: { fields: Object.keys(picked) },
  });

  revalidateTag(schoolTag(school.slug), { expire: 0 });
  const apex = process.env.APEX_DOMAIN ?? "lacakedu.web.id";
  await purgeEdge([
    `https://${school.slug}.${apex}/`,
    `https://${school.slug}.${apex}/buku`,
    `https://${school.slug}.${apex}/privasi`,
  ]);

  const after = await root.school.findUnique({ where: { id }, include: { settings: true } });
  return NextResponse.json({ school: after });
}
