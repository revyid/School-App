import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

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

// GET /api/notifications?unread=1 — daftar notifikasi saya (terbaru dulu).
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.notification.findMany({
      where: { userId: a.userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    }));
  const unread = await runAsSchool(db, a.school.id, (tx) =>
    tx.notification.count({ where: { userId: a.userId, readAt: null } }));
  return NextResponse.json({ rows, unread });
}

// POST /api/notifications/read {ids?} — tandai dibaca (kosong = semua).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.slice(0, 100).map(String) : null;
  const now = new Date();
  if (ids && ids.length > 0) {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.notification.updateMany({ where: { userId: a.userId, id: { in: ids }, readAt: null }, data: { readAt: now } }));
  } else {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.notification.updateMany({ where: { userId: a.userId, readAt: null }, data: { readAt: now } }));
  }
  return NextResponse.json({ ok: true });
}
