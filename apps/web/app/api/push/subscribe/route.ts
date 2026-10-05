import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { randomUUID } from "node:crypto";
import { endpointHash } from "@/server/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAny = db as any;

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
}

// POST /api/push/subscribe — simpan subscription (upsert per endpoint).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const body = await req.json().catch(() => null);
  const { endpoint, keys } = body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "payload tidak valid" }, { status: 400 });
  }

  const hash = endpointHash(String(endpoint));
  const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await dbAny.pushSubscription.upsert({
    where: { userId_endpointHash: { userId: a.userId, endpointHash: hash } },
    create: {
      id: randomUUID(),
      userId: a.userId,
      endpoint: String(endpoint),
      endpointHash: hash,
      p256dh: String(keys.p256dh),
      auth: String(keys.auth),
      userAgent: ua,
    },
    update: { p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent: ua },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe — hapus subscription perangkat ini.
export async function DELETE(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const body = await req.json().catch(() => null);
  const { endpoint } = body ?? {};
  if (!endpoint) return NextResponse.json({ error: "endpoint wajib" }, { status: 400 });

  const hash = endpointHash(String(endpoint));
  await dbAny.pushSubscription.deleteMany({
    where: { userId: a.userId, endpointHash: hash },
  });
  return NextResponse.json({ ok: true });
}
