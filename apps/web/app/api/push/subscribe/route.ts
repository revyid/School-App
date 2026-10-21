import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { randomUUID } from "node:crypto";
import { endpointHash } from "@/server/push";

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

  try {
    await runAsSchool(db, a.school.id, (tx) => tx.pushSubscription.upsert({
      where: { userId_endpointHash: { userId: a.userId, endpointHash: hash } },
      create: {
        id: randomUUID(),
        schoolId: a.school.id,
        userId: a.userId,
        endpoint: String(endpoint),
        endpointHash: hash,
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
        userAgent: ua,
      },
      update: { p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent: ua },
    }));
  } catch (e) {
    console.error("push subscribe gagal", e);
    const code = (e as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ error: "perangkat ini sudah terdaftar" }, { status: 409 });
    }
    if (code === "P2021" || code === "P2010") {
      return NextResponse.json(
        { error: "tabel langganan belum siap (migrasi DB belum jalan) — hubungi admin" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: `gagal menyimpan langganan (${code ?? "unknown"}) — coba lagi atau hubungi admin` }, { status: 500 });
  }

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
  try {
    await runAsSchool(db, a.school.id, (tx) => tx.pushSubscription.deleteMany({
      where: { userId: a.userId, endpointHash: hash },
    }));
  } catch (e) {
    console.error("push unsubscribe gagal", e);
    return NextResponse.json({ error: "gagal menghapus langganan, coba lagi" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
