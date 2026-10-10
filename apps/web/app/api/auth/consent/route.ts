import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/auth/consent — ambil status persetujuan user yang sedang login
export async function GET(req: NextRequest) {
  const auth = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
  });
  if (!auth.ok || !auth.school) return NextResponse.json({ consented: false });

  const row = await runAsSchool(db, auth.school.id, (tx) =>
    tx.parentalConsent.findUnique({ where: { studentId: auth.userId } }));
  return NextResponse.json({ consented: Boolean(row?.consented), consentedAt: row?.consentedAt });
}

// POST /api/auth/consent — simpan persetujuan UU PDP
export async function POST(req: NextRequest) {
  const auth = await authorize({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
  });
  if (!auth.ok || !auth.school) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  await runAsSchool(db, auth.school.id, (tx) =>
    tx.parentalConsent.upsert({
      where: { studentId: auth.userId },
      update: { consented: true, consentedAt: now },
      create: { schoolId: auth.school.id, studentId: auth.userId, consented: true, consentedAt: now },
    }));

  return NextResponse.json({ ok: true, consentedAt: now });
}