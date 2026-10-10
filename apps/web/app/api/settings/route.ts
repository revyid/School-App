import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { settingsSchema } from "@sms/shared/master";

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
  return NextResponse.json({ settings: row });
}
