import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { collabInputSchema, collabSenderShown } from "@sms/shared/portal";
import { saveCollabFile } from "@/server/collab-files";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

function mask(t: { anonymous: boolean; senderId: string; sender: { name: string } }, a: { role: string; userId: string }) {
  const shown = collabSenderShown(t, { role: a.role, userId: a.userId, revealed: false });
  return shown ? t.sender.name : "Anonim";
}

// GET /api/collab — GURU: thread yang mencantumkannya. SISWA: miliknya. ADMIN: semua.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const where =
    a.role === "ADMIN"
      ? {}
      : a.role === "GURU"
        ? { recipients: { has: a.userId } }
        : { senderId: a.userId };
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.findMany({
      where,
      include: {
        sender: { select: { name: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }));
  return NextResponse.json({
    rows: rows.map((t) => ({
      id: t.id, subject: t.subject, anonymous: t.anonymous,
      sender: t.revealedAt ? t.sender.name : mask(t, a),
      revealed: !!t.revealedAt,
      messages: t.messages.map((m) => ({ id: m.id, authorId: m.authorId, body: m.body, fileName: m.fileName, createdAt: m.createdAt })),
    })),
  });
}

// POST /api/collab (multipart: subject, anonymous, recipients JSON, body, file?) — SISWA/GURU kirim.
// recipients harus user GURU aktif di sekolah ini.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.includes("multipart/form-data")) {
    return NextResponse.json({ error: "gunakan form" }, { status: 400 });
  }
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "form tidak valid" }, { status: 400 });
  let recipients: string[] = [];
  try {
    recipients = JSON.parse(String(form.get("recipients") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "recipients harus JSON array" }, { status: 400 });
  }
  const parsed = collabInputSchema.safeParse({
    subject: String(form.get("subject") ?? ""),
    anonymous: String(form.get("anonymous") ?? "false") === "true",
    recipients,
    body: String(form.get("body") ?? ""),
  });
  if (!parsed.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const gurus = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findMany({
      where: { id: { in: parsed.data.recipients }, role: "GURU", isActive: true },
      select: { id: true },
      take: 20,
    }));
  if (gurus.length !== parsed.data.recipients.length) {
    return NextResponse.json({ error: "penerima harus guru aktif" }, { status: 400 });
  }
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.collabThread.create({
      data: {
        schoolId: a.school.id,
        senderId: a.userId,
        subject: parsed.data.subject,
        anonymous: a.role === "SISWA" ? parsed.data.anonymous : false,
        recipients: parsed.data.recipients,
        messages: { create: { schoolId: a.school.id, authorId: a.userId, body: parsed.data.body } },
      },
    }));
  const f = form.get("file");
  if (f && typeof f !== "string") {
    try {
      const name = await saveCollabFile(a.school.id, t.id, Buffer.from(await f.arrayBuffer()));
      await runAsSchool(db, a.school.id, (tx) =>
        tx.collabMessage.updateMany({ where: { threadId: t.id }, data: { fileName: name } }));
    } catch (e) {
      await runAsSchool(db, a.school.id, (tx) =>
        tx.collabThread.delete({ where: { id: t.id } }));
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }
  await logAuth(a.school.id, "COLLAB.CREATE", { actorId: a.userId, meta: { id: t.id } });
  return NextResponse.json({ thread: { id: t.id } }, { status: 201 });
}
