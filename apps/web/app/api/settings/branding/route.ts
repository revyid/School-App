import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { saveBrandImage, MAX_LOGO_BYTES } from "@/server/images";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";

// POST /api/settings/branding — ADMIN sekolah: unggah gambar karakter / banner /
// hero sekolah. File disimpan di <UPLOADS_ROOT>/<schoolId>/branding/ dan
// direferensikan sebagai path relatif ("branding/<nama>") supaya tak bocor path.
export async function POST(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const kind = (new URL(req.url).searchParams.get("kind") ?? "character").trim();
  if (!["character", "siswa", "book", "banner", "hero"].includes(kind))
    return NextResponse.json({ error: "jenis tidak dikenal" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const saved = await saveBrandImage({
    file,
    dir: "branding",
    subDir: a.school.id,
    maxBytes: MAX_LOGO_BYTES,
    tooLargeStatus: 413,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });

  const field =
    kind === "character" ? "characterImageUrl"
    : kind === "siswa" ? "siswaImageUrl"
    : kind === "book" ? "bookImageUrl"
    : kind === "banner" ? "dashboardBannerUrl"
    : "heroImageUrl";
  await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.upsert({
      where: { schoolId: a.school.id },
      update: { [field]: `branding/${saved.name}` },
      create: { schoolId: a.school.id, [field]: `branding/${saved.name}` },
    }),
  );
  return NextResponse.json({ ok: true, kind, path: `branding/${saved.name}` }, { status: 201 });
}
