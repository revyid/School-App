// IP resolution for audit logging.
//
// Web app sits behind a proxy (nginx) that forwards X-Forwarded-For.
// XFF may hold a chain: "client, proxy1, proxy2" — leftmost = original
// client. X-Real-IP is the legacy single-IP header. Only when neither
// header is present we fall back to the socket's own remote address.
// This keeps `logAuth` consistent regardless of how each route reads req.

import type { NextRequest } from "next/server";

export function ipOf(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff?.trim()) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0]; // leftmost chain entry = origin client
  }

  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim().split(",")[0].trim();

  // Fallback: next-server exposes socket via request.socket in server components/routes.
  // For a plain NextRequest (client→route), remoteAddress is not part of the
  // type; fall back to "unknown" when there is no socket.
  const socket = (req as { socket?: { remoteAddress?: string } }).socket;
  return socket?.remoteAddress ?? "unknown";
}
