import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { purgeEdge } from "@/server/cf-purge";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { settingsSchema } from "@sms/shared/master";
import { schoolTag } from "@/lib/public-cache";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// GET /api/settings — semua role terautentikasi (SchoolSettings ikut RLS tenant).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const s = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: a.school.id } }),
  );
  const school = await runAsSchool(db, a.school.id, (tx) =>
    tx.school.findUnique({ where: { id: a.school.id }, select: { lat: true, lng: true } }),
  );
  return NextResponse.json({
    settings: {
      portalName: a.school.name,
      startTime: "07:00",
      cutoffTime: "07:30",
      waDailyCap: 200,
      waPerMinuteCap: 10,
      ctaGtkUrl: null,
      ctaMuridUrl: null,
      studentRetentionDays: 90,
      photoRetentionDays: 30,
      defaultPasswordMode: "random",
      aiChatEnabled: s?.aiChatEnabled ?? false,
      aiShareStudentData: s?.aiShareStudentData ?? false,
      ttsPhrase: "{{name}} sudah hadir",
      ttsPhraseDup: "{{name}} sudah di catat",
      ...(s ?? {}),
      mapLat: school?.lat ?? null,
      mapLng: school?.lng ?? null,
    },
  });
}

// PATCH /api/settings — ADMIN saja (upsert per sekolah).
export async function PATCH(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const { expRules, mapLat, mapLng, ...rest } = body.data;
  if (mapLat !== undefined || mapLng !== undefined) {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.school.update({
        where: { id: a.school.id },
        data: {
          ...(mapLat !== undefined ? { lat: mapLat } : {}),
          ...(mapLng !== undefined ? { lng: mapLng } : {}),
        },
      }),
    );
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.upsert({
      where: { schoolId: a.school.id },
      // Prisma Json opsional: undefined = tak diubah; object = set; null = set DB NULL.
      update: {
        ...rest,
        ...(expRules === undefined ? {} : expRules === null ? { expRules: undefined } : { expRules }),
      },
      create: { schoolId: a.school.id, ...rest, ...(expRules ? { expRules } : {}) },
    }),
  );
  await logAuth(a.school.id, "SETTINGS.UPDATE", { actorId: a.userId });
  // Data publik sekolah (portal, buku, legal) memakai tag school:<slug>.
  revalidateTag(schoolTag(a.school.slug), { expire: 0 });
  await purgeEdge([
    `https://${a.school.slug}.${process.env.APEX_DOMAIN ?? "lacakedu.web.id"}/`,
    `https://${a.school.slug}.${process.env.APEX_DOMAIN ?? "lacakedu.web.id"}/buku`,
    `https://${a.school.slug}.${process.env.APEX_DOMAIN ?? "lacakedu.web.id"}/privasi`,
  ]);
  return NextResponse.json({ settings: row });
}
