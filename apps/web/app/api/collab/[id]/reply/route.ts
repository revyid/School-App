import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { collabReplySchema } from "@sms/shared/portal";

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

async function loadThread(schoolId: string, id: string) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.collabThread.findUnique({ where: { id: id.slice(0, 64) } }));
}

function canAccess(t: { senderId: string; recipients: string[] }, role: string, userId: string): boolean {
  if (role === "ADMIN") return true;
  if (t.senderId === userId) return true;
  if (role === "GURU" && t.recipients.includes(userId)) return true;
  return false;
}

// POST /api/collab/[id]/reply {body} — peserta thread (pengirim/penerima/admin).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = collabReplySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const t = await loadThread(a.school.id, id);
  if (!t) return NextResponse.json({ error: "thread tidak ditemukan" }, { status: 404 });
  if (!canAccess(t, a.role, a.userId)) {
    return NextResponse.json({ error: "bukan peserta thread ini" }, { status: 403 });
  }
  const m = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabMessage.create({
      data: { schoolId: a.school.id, threadId: t.id, authorId: a.userId, body: body.data.body },
    }));
  await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.update({ where: { id: t.id }, data: { updatedAt: new Date() } }));
  return NextResponse.json({ message: { id: m.id } }, { status: 201 });
}
