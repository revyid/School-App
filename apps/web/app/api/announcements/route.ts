import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { announcementInputSchema, announcementVisible } from "@sms/shared/portal";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

async function viewerCtx(schoolId: string, role: string, userId: string): Promise<{ role: string; classId: string | null }> {
  if (role === "SISWA") {
    const p = await runAsSchool(db, schoolId, (tx) =>
      tx.studentProfile.findUnique({ where: { userId }, select: { classId: true } }));
    return { role, classId: p?.classId ?? null };
  }
  return { role, classId: null };
}

// GET /api/announcements — terfilter target server-side.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const now = new Date();
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.announcement.findMany({
      where: { publishAt: { lte: now } },
      orderBy: { publishAt: "desc" },
      take: 100,
    }));
  const v = await viewerCtx(a.school.id, a.role, a.userId);
  return NextResponse.json({ rows: rows.filter((r) => announcementVisible(r.target, v)) });
}

// POST /api/announcements — ADMIN saja.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = announcementInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.announcement.create({
      data: {
        schoolId: a.school.id,
        authorId: a.userId,
        title: body.data.title,
        body: body.data.body,
        target: body.data.target,
        publishAt: body.data.publishAt ? new Date(body.data.publishAt) : new Date(),
      },
    }));
  await logAuth(a.school.id, "ANNOUNCE.CREATE", { actorId: a.userId, meta: { id: row.id } });
  return NextResponse.json({ announcement: row }, { status: 201 });
}
