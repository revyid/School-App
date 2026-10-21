// IP resolution for audit logging dan rate limit.
//
// Web app selalu di belakang nginx (satu-satunya pintu masuk), dan nginx
// menulis ulang X-Real-IP = $remote_addr (setelah real_ip dari
// CF-Connecting-IP untuk request via Cloudflare). Jadi X-Real-IP adalah satu-
//-satunya header yang dikontrol server.
//
// X-Forwarded-For bisa dipalsukan klien: nginx TIDAK pernah meneruskan XFF
// dari klien apa adanya (kita set explicit = $remote_addr), tapi kalau ada
// proxy lain di depan, rantai XFF bisa berisi nilai palsu. Karena itu
// X-Real-IP didahulukan, dan XFF hanya dipakai sebagai cadangan terakhir.

import type { NextRequest } from "next/server";

export function ipOf(req: NextRequest): string {
  const real = req.headers.get("x-real-ip")?.trim().split(",")[0]?.trim();
  if (real) return real;

  const xff = req.headers.get("x-forwarded-for");
  if (xff?.trim()) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[0];
  }

  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  // Fallback: next-server exposes socket via request.socket in server components/routes.
  // For a plain NextRequest (client→route), remoteAddress is not part of the
  // type; fall back to "unknown" when there is no socket.
  const socket = (req as { socket?: { remoteAddress?: string } }).socket;
  return socket?.remoteAddress ?? "unknown";
}
