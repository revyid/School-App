import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { notifyUser } from "@/server/notify";

// POST /api/push/test — kirim notifikasi uji ke diri sendiri (in-app + Web Push).
// Dipakai tombol "Kirim notifikasi uji" di halaman admin/notifikasi.
export async function POST(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  await notifyUser(
    a.school.id,
    a.userId,
    "Notifikasi uji",
    "Kalau notif ini muncul di HP/browser, Web Push sudah jalan.",
    "/",
  );
  return NextResponse.json({ ok: true });
}
