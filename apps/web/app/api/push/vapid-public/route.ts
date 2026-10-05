// GET /api/push/vapid-public — kembalikan VAPID public key untuk SW subscribe.
// Tidak butuh auth (public key memang boleh publik).
import { NextResponse } from "next/server";

export async function GET() {
  const pub = process.env.VAPID_PUBLIC;
  if (!pub) return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  return NextResponse.json({ publicKey: pub });
}
