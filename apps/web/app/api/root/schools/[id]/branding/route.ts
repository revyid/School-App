import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";
import { saveBrandImage, MAX_LOGO_BYTES } from "@/server/images";
import { logAuth } from "@/server/audit";
import { schoolTag } from "@/lib/public-cache";
import { purgeEdge } from "@/server/cf-purge";

// POST /api/root/schools/[id]/branding?kind=character|banner|hero — SUPER_ADMIN:
// unggah branding sekolah mana pun, disimpan di <UPLOADS_ROOT>/<schoolId>/branding/.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const { id } = await params;
  const kind = (new URL(req.url).searchParams.get("kind") ?? "character").trim();
  if (!["character", "banner", "hero"].includes(kind))
    return NextResponse.json({ error: "jenis tidak dikenal" }, { status: 400 });

  const root = getRootDb();
  const school = await root.school.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!school) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const saved = await saveBrandImage({
    file: form?.get("file"),
    dir: "branding",
    subDir: school.id,
    maxBytes: MAX_LOGO_BYTES,
    tooLargeStatus: 413,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });

  const field = kind === "character" ? "characterImageUrl" : kind === "banner" ? "dashboardBannerUrl" : "heroImageUrl";
  await root.schoolSettings.upsert({
    where: { schoolId: school.id },
    update: { [field]: `branding/${saved.name}` },
    create: { schoolId: school.id, [field]: `branding/${saved.name}` },
  });

  await logAuth(school.id, "ROOT.SCHOOL_BRANDING", { actorId: a.userId, meta: { kind } });
  revalidateTag(schoolTag(school.slug), { expire: 0 });
  const apex = process.env.APEX_DOMAIN ?? "lacakedu.web.id";
  await purgeEdge([`https://${school.slug}.${apex}/`, `https://${school.slug}.${apex}/buku`]);

  return NextResponse.json({ ok: true, kind, path: `branding/${saved.name}` }, { status: 201 });
}
