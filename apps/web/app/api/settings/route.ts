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
  return NextResponse.json({
    settings: s ?? {
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
    },
  });
}

// PATCH /api/settings — ADMIN saja (upsert per sekolah).
export async function PATCH(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const d = body.data;
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.upsert({
      where: { schoolId: a.school.id },
      update: { ...d },
      create: { schoolId: a.school.id, ...d },
    }),
  );
  await logAuth(a.school.id, "SETTINGS.UPDATE", { actorId: a.userId });
  return NextResponse.json({ settings: row });
}
