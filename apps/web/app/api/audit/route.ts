import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/audit?take=&cursor= — ADMIN saja. Pagination cursor (createdAt+id), take maks 100.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("take") ?? "50") || 50));
  const cursor = url.searchParams.get("cursor");
  const action = url.searchParams.get("action")?.slice(0, 64);
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.auditLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(cursor
          ? { id: { lt: cursor } }
          : {}),
      },
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { id: "desc" },
      take: take + 1,
    }));
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return NextResponse.json({
    rows: page.map((r) => ({
      id: r.id, action: r.action, actor: r.actor?.name ?? "?", role: r.actor?.role ?? "?",
      entity: r.entity, entityId: r.entityId, ip: r.ip, createdAt: r.createdAt,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
