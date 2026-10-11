import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// GET /api/assessments/[id] — detail milik guru (atau semua untuk ADMIN).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({
      where: { id: id.slice(0, 64) },
      include: { _count: { select: { questions: true, attempts: true } } },
    }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  return NextResponse.json({ assessment: as });
}

// PATCH /api/assessments/[id] — toggle showChart (+ judul/deadline opsional).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const as = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, authorId: true } }));
  if (!as) return NextResponse.json({ error: "asesmen tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU" && as.authorId !== a.userId) {
    return NextResponse.json({ error: "bukan asesmen Anda" }, { status: 403 });
  }
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "body tidak valid" }, { status: 400 });
  const data: { showChart?: boolean; title?: string; deadline?: Date | null } = {};
  if (typeof body.showChart === "boolean") data.showChart = body.showChart;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 200);
  if (body.deadline === null) data.deadline = null;
  else if (typeof body.deadline === "string" && body.deadline) {
    const d = new Date(body.deadline);
    if (!Number.isNaN(d.getTime())) data.deadline = d;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "tidak ada perubahan" }, { status: 400 });
  }
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessment.update({ where: { id: as.id }, data }));
  await logAuth(a.school.id, "ASSESS.UPDATE", { actorId: a.userId, meta: { id: row.id, ...data } });
  return NextResponse.json({ assessment: row });
}
