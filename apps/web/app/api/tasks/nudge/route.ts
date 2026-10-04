import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { renderTemplate, DEFAULT_TEMPLATES } from "@sms/shared/notify";
import { notifyUser } from "@/server/notify";
import { enqueueOutbox } from "@/server/outbox";
import { guruClassIds } from "@/server/lms-scope";

const bodySchema = z.object({
  taskId: z.string().min(1).max(64),
  kind: z.enum(["reminder", "thanks"]),
});

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["ADMIN", "GURU"],
  });
}

// POST /api/tasks/nudge {taskId, kind: reminder|thanks} — guru kirim pengingat
// ke yang belum mengumpulkan / terima kasih ke yang sudah (in-app + WA ortu).
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:nudge:${a.school.id}:${a.userId}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: body.data.taskId },
      select: { id: true, title: true, deadline: true, classId: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(t.classId)) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const subs = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findMany({ where: { taskId: t.id }, select: { studentId: true } }));
  const done = new Set(subs.map((s) => s.studentId));
  const roster = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId },
      include: {
        user: { select: { id: true, name: true } },
      },
      take: 1000,
    }));
  const dl = t.deadline ? new Date(t.deadline).toLocaleDateString("id-ID") : "-";
  let targets = roster.filter((r) =>
    body.data.kind === "reminder" ? !done.has(r.user.id) : done.has(r.user.id));
  targets = targets.slice(0, 500);
  let inapp = 0;
  let wa = 0;
  for (const r of targets) {
    const tpl = body.data.kind === "reminder" ? DEFAULT_TEMPLATES.reminder : DEFAULT_TEMPLATES.thanks;
    const msg = renderTemplate(tpl, { nama: r.user.name, judul: t.title, deadline: dl });
    await notifyUser(a.school.id, r.user.id,
      body.data.kind === "reminder" ? "Pengingat tugas" : "Terima kasih",
      msg).catch(() => {});
    inapp++;
    if (r.parentPhone) {
      const key = body.data.kind === "reminder" ? `nudge-r-${t.id}-${r.user.id}` : `nudge-t-${t.id}-${r.user.id}`;
      const res = await enqueueOutbox(a.school.id, r.parentPhone, msg, key).catch(() => null);
      if (res && !res.duplicate) wa++;
    }
  }
  await logAuth(a.school.id, "TASK.NUDGE", {
    actorId: a.userId, meta: { taskId: t.id, kind: body.data.kind, inapp, wa },
  });
  return NextResponse.json({ ok: true, inapp, wa });
}
