import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@sms/db/root";

type AuditRow = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  createdAt: Date;
  actorName: string | null;
  actorRole: string | null;
};

// GET /api/root/audit?take&cursor&action — SUPER_ADMIN lintas sekolah.
// Cursor = id terakhir; urutan createdAt+id.
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

  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") ?? "50") || 50));
  const cursor = (url.searchParams.get("cursor") ?? "").slice(0, 64) || null;
  const action = (url.searchParams.get("action") ?? "").slice(0, 64) || null;

  const rows = await getRootDb().$queryRaw<AuditRow[]>`
    SELECT l.id, l.action, l.entity, l."entityId", l.ip, l."createdAt",
           u.name AS "actorName", u.role::text AS "actorRole"
    FROM "AuditLog" l
    LEFT JOIN "User" u ON u.id = l."actorId"
    WHERE (${action}::text IS NULL OR l.action ILIKE '%' || ${action} || '%')
      AND (${cursor}::text IS NULL OR (l."createdAt", l.id) <
           (SELECT c."createdAt", c.id FROM "AuditLog" c WHERE c.id = ${cursor}))
    ORDER BY l."createdAt" DESC, l.id DESC
    LIMIT ${take + 1}`;

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  // Percobaan login level platform (akun root tidak punya sekolah).
  const rootAttempts = await getRootDb().$queryRaw<{ id: string; email: string; action: string; ip: string | null; createdAt: Date }[]>`
    SELECT id, email, action, ip, "createdAt"
    FROM "RootAuthAttempt"
    ORDER BY "createdAt" DESC
    LIMIT 25`;

  return NextResponse.json({
    rows: page.map((r) => ({
      id: r.id,
      action: r.action,
      actor: { name: r.actorName ?? "?", role: r.actorRole ?? "?" },
      entity: r.entity,
      entityId: r.entityId,
      ip: r.ip,
      createdAt: r.createdAt,
    })),
    rootAttempts: rootAttempts.map((r) => ({
      id: r.id,
      email: r.email,
      action: r.action,
      ip: r.ip,
      createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
