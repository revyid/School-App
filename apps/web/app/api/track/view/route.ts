import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/server/redis";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicSchool } from "@/lib/public-cache";
import { ipOf } from "@/server/request-ip";

// POST /api/track/view — counter view per hari (TOTAL, bukan unik).
// Publik (tanpa login): halaman portal bisa dibuka siapa saja. Dibatasi:
//   - hanya jenis konten yang dikenal
//   - satu hit per konten per identitas (sesi/ IP) per 15 menit
//   - limiter per IP supaya tidak bisa dipakai membanjiri baris
const KINDS = ["BOOK", "MATERIAL", "TASK", "ANNOUNCEMENT", "PORTAL"] as const;
const THROTTLE_SEC = 15 * 60;
const MAX_PER_HOUR = 120;

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "lacakedu.web.id";
  const slug = schoolSlugFromHost(host, apex);
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { kind?: unknown; entityId?: unknown } | null;
  const kind = typeof body?.kind === "string" ? body.kind : "";
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";
  if (!KINDS.includes(kind as (typeof KINDS)[number]) || !/^[A-Za-z0-9_-]{1,64}$/.test(entityId)) {
    return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  }

  const rl = await redis.incr(`rl:view:${ipOf(req)}`);
  if (rl === 1) await redis.expire(`rl:view:${ipOf(req)}`, 3600);
  if (rl > MAX_PER_HOUR) return NextResponse.json({ error: "terlalu banyak permintaan" }, { status: 429 });

  const school = await getPublicSchool(slug);
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Identitas: sesi kalau ada, kalau tidak IP (agar siswa yang berbagi IP NAT
  // tetap terhitung terpisah).
  const sid = req.cookies.get("__Host-session")?.value;
  const ident = sid ? `s:${sid.slice(0, 16)}` : `i:${ipOf(req)}`;
  const tKey = `v:${school.id}:${kind}:${entityId}:${ident}`;
  const first = await redis.set(tKey, "1", "EX", THROTTLE_SEC, "NX");
  if (!first) return NextResponse.json({ ok: true, counted: false });

  // Tulis di bawah konteks tenant (RLS ContentView).
  await runAsSchool(db, school.id, (tx) =>
    tx.contentView.upsert({
      where: {
        schoolId_kind_entityId_day: {
          schoolId: school.id,
          kind,
          entityId,
          day: new Date(new Date().toISOString().slice(0, 10)),
        },
      },
      create: { schoolId: school.id, kind, entityId, day: new Date(new Date().toISOString().slice(0, 10)), count: 1 },
      update: { count: { increment: 1 } },
    }),
  );
  return NextResponse.json({ ok: true, counted: true });
}
