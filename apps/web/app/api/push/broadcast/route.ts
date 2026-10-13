import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { sendPushToUser } from "@/server/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAny = db as any;

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
}

type Target = "semua" | "guru" | "siswa" | "kelas";

// POST /api/push/broadcast — ADMIN saja.
// Body: { target, classId?, title, body }
// Rate-limit: 1x per menit per sekolah. Return: { sent, failed }.
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const rl = await hit(`rl:push-broadcast:${a.school.id}`, 1, 60);
  if (!rl.ok)
    return NextResponse.json(
      { error: `Terlalu sering — coba lagi dalam ${rl.retryAfter} detik` },
      { status: 429 },
    );

  const payload = await req.json().catch(() => null);
  const target = String(payload?.target ?? "semua") as Target;
  const classId = typeof payload?.classId === "string" ? payload.classId : null;
  const title = String(payload?.title ?? "").trim();
  const body = String(payload?.body ?? "").trim();

  if (!["semua", "guru", "siswa", "kelas"].includes(target))
    return NextResponse.json({ error: "target tidak valid" }, { status: 400 });
  if (!title || !body)
    return NextResponse.json({ error: "Judul dan isi pesan wajib diisi" }, { status: 400 });
  if (target === "kelas" && !classId)
    return NextResponse.json({ error: "Pilih kelas dulu" }, { status: 400 });

  let userIds: string[];
  if (target === "guru") {
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findMany({ where: { role: "GURU", isActive: true }, select: { id: true }, take: 5000 }),
    );
    userIds = rows.map((r) => r.id);
  } else if (target === "siswa") {
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findMany({ where: { role: "SISWA", isActive: true }, select: { id: true }, take: 5000 }),
    );
    userIds = rows.map((r) => r.id);
  } else if (target === "kelas") {
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findMany({
        where: { classId, user: { isActive: true } },
        select: { userId: true },
        take: 5000,
      }),
    );
    userIds = rows.map((r) => r.userId);
  } else {
    const rows = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findMany({ where: { isActive: true }, select: { id: true }, take: 5000 }),
    );
    userIds = rows.map((r) => r.id);
  }

  let sent = 0;
  let failed = 0;
  await Promise.allSettled(
    userIds.map(async (uid) => {
      const n = await runAsSchool(db, a.school.id, (tx) =>
        tx.pushSubscription.count({ where: { userId: uid } }),
      );
      if (n === 0) {
        failed += 1;
        return;
      }
      try {
        await sendPushToUser(uid, title, body, "/");
        sent += 1;
      } catch {
        failed += 1;
      }
    }),
  );

  return NextResponse.json({ sent, failed });
}
