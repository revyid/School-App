import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";

// GET /api/wa/ready — status sesi WhatsApp (untuk tombol WA guru, T7).
// Boleh dibaca GURU/ADMIN. Proxy server-side ke worker loopback.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const token = process.env.INTERNAL_TOKEN ?? "";
  const port = process.env.WORKER_PORT ?? "3001";
  try {
    const r = await fetch(`http://127.0.0.1:${port}/wa-status?schoolId=${a.school.id}`, {
      headers: { "x-internal-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return NextResponse.json({ connected: false });
    const d = (await r.json().catch(() => ({}))) as { connected?: boolean };
    return NextResponse.json({ connected: d.connected === true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
