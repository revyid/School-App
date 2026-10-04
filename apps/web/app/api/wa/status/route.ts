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
    roles: ["ADMIN"],
  });
}

// GET /api/wa/status — status sesi WA sekolah ini + QR pairing (bila putus).
// Proxy server-side ke worker loopback (INTERNAL_TOKEN); browser tak pernah
// menyentuh worker langsung.
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const port = Number(process.env.WORKER_PORT ?? 3001);
  const token = process.env.INTERNAL_TOKEN ?? "";
  if (!token) return NextResponse.json({ connected: false, detail: "INTERNAL_TOKEN belum diset" });
  try {
    const r = await fetch(`http://127.0.0.1:${port}/wa-status?schoolId=${a.school.id}`, {
      headers: { "x-internal-token": token },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ connected: false, detail: "worker error" });
    // Notifikasi in-app saat sesi putus (sekali per 24 jam: dedupe via notifikasi terakhir).
    if (d.connected === false) {
      const recent = await runAsSchool(db, a.school.id, (tx) =>
        tx.notification.findFirst({
          where: {
            title: "Sesi WA putus",
            createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
          },
          orderBy: { createdAt: "desc" },
        }));
      if (!recent) {
        const admins = await runAsSchool(db, a.school.id, (tx) =>
          tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true }, take: 20 }));
        for (const ad of admins) {
          await notifyUser(a.school.id, ad.id, "Sesi WA putus",
            "Sesi WhatsApp sekolah terputus. Buka halaman WA admin untuk pairing ulang.").catch(() => {});
        }
      }
    }
    return NextResponse.json(d);
  } catch {
    return NextResponse.json({ connected: false, detail: "worker tidak terjangkau" });
  }
}
