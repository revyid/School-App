import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { cleanText, synthesize } from "@/server/tts";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
}

// GET /api/tts?text=... — sintesis Piper ID (server-side), WAV, cache per hash teks.
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const text = cleanText(new URL(req.url).searchParams.get("text") ?? "");
  if (!text) return NextResponse.json({ error: "text wajib" }, { status: 400 });
  try {
    const wav = await synthesize(text);
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "content-length": String(wav.byteLength),
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
