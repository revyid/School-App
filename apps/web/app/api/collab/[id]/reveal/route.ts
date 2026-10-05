import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";

// POST /api/collab/[id]/reveal — ADMIN saja, tercatat audit COLLAB.REVEAL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.findUnique({ where: { id: id.slice(0, 64) } }));
  if (!t) return NextResponse.json({ error: "thread tidak ditemukan" }, { status: 404 });
  if (!t.anonymous) return NextResponse.json({ error: "thread tidak anonim" }, { status: 400 });
  const sender = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({ where: { id: t.senderId }, select: { id: true, name: true } }));
  await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.update({
      where: { id: t.id },
      data: { revealedAt: new Date(), revealedById: a.userId },
    }));
  await logAuth(a.school.id, "COLLAB.REVEAL", { actorId: a.userId, meta: { id: t.id } });
  return NextResponse.json({ sender });
}
