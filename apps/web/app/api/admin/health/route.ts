import { statfs } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { redis } from "@/server/redis";

// GET /api/admin/health — SUPER_ADMIN saja (via admin.<apex>).
// Agregat: jumlah sekolah, sesi WA (dari worker internal), antrean, disk, backup terakhir.
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

  // School SELECT publik untuk app_user (policy school_public_read) — aman tanpa SYSTEM_URL.
  const schools = await db.school.findMany({
    select: { id: true, slug: true, name: true },
    take: 500,
  });

  let queues: Record<string, { waiting: number; failed: number }> = {};
  try {
    for (const q of ["import", "wa"]) {
      const waiting = await redis.llen(`bull:${q}:wait`).catch(() => 0);
      const failed = await redis.zcard(`bull:${q}:failed`).catch(() => 0);
      queues[q] = { waiting: Number(waiting) || 0, failed: Number(failed) || 0 };
    }
  } catch {
    queues = { error: { waiting: -1, failed: -1 } };
  }

  let wa: unknown = null;
  try {
    const base = `http://127.0.0.1:${process.env.WORKER_PORT ?? "3001"}`;
    const r = await fetch(`${base}/wa-status-all`, {
      headers: { "x-internal-token": process.env.INTERNAL_TOKEN ?? "" },
      signal: AbortSignal.timeout(8000),
    });
    wa = r.ok ? await r.json() : { error: r.status };
  } catch (e) {
    wa = { error: (e as Error).message };
  }

  let disk: unknown = null;
  try {
    const root = process.env.UPLOADS_ROOT ?? "/data/uploads";
    const s = await statfs(root);
    disk = { bfree: String(s.bfree), bsize: s.bsize };
  } catch (e) {
    disk = { error: (e as Error).message };
  }

  return NextResponse.json({
    schools: schools.map((s: { id: string; slug: string; name: string }) => ({ id: s.id, slug: s.slug, name: s.name })),
    schoolCount: schools.length,
    queues,
    wa,
    disk,
    backup: {
      lastAt: process.env.BACKUP_LAST_AT ?? null,
      lastResult: process.env.BACKUP_LAST_RESULT ?? null,
    },
    time: new Date().toISOString(),
  });
}
