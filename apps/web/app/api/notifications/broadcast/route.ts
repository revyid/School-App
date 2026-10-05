import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { notifyUser } from "@/server/notify";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// POST /api/notifications/broadcast
// Body: { title: string, body: string, targetRole?: "ALL" | "SISWA" | "GURU" }
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const payload = await req.json().catch(() => null);
  const title = String(payload?.title ?? "").trim();
  const body = String(payload?.body ?? "").trim();
  const targetRole = payload?.targetRole ?? "ALL";

  if (!title || !body) {
    return NextResponse.json({ error: "Judul dan pesan tidak boleh kosong" }, { status: 400 });
  }

  // Cari target user sesuai role
  const whereClause: any = { schoolId: a.school.id, isActive: true };
  if (targetRole === "SISWA") whereClause.role = "SISWA";
  if (targetRole === "GURU") whereClause.role = "GURU";

  const users = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findMany({
      where: whereClause,
      select: { id: true },
    })
  );

  // Kirim notifikasi in-app & push notification sekaligus
  let count = 0;
  for (const u of users) {
    await notifyUser(a.school.id, u.id, title, body);
    count++;
  }

  return NextResponse.json({ ok: true, sentCount: count });
}
