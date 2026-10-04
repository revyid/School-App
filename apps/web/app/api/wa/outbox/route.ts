import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { waSendSchema, normalizePhone } from "@sms/shared/notify";
import { enqueueOutbox } from "@/server/outbox";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

// GET /api/wa/outbox — status antrean (ADMIN; GURU hanya lihat, tak bisa kirim manual).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.messageOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 }));
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const sentDay = await runAsSchool(db, a.school.id, (tx) =>
    tx.messageOutbox.count({ where: { status: "SENT", sentAt: { gte: dayAgo } } }));
  const settings = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: a.school.id } }));
  return NextResponse.json({
    rows: rows.map((r) => ({ ...r, text: r.text.slice(0, 160) })),
    quota: { sentDay, dailyCap: settings?.waDailyCap ?? 300, perMinuteCap: settings?.waPerMinuteCap ?? 10 },
  });
}

// POST /api/wa/outbox {to, text, dedupeKey?} — ADMIN saja (kirim manual).
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:wa:${a.school.id}:${a.userId}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = waSendSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const to = normalizePhone(body.data.to);
  if (!to) return NextResponse.json({ error: "nomor tidak valid (format 08…/62…)" }, { status: 400 });
  const r = await enqueueOutbox(a.school.id, to, body.data.text, body.data.dedupeKey);
  await logAuth(a.school.id, "WA.ENQUEUE", { actorId: a.userId, meta: { id: r.id } });
  return NextResponse.json(r, { status: 201 });
}
