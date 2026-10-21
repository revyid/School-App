import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { purgeEdge } from "@/server/cf-purge";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { saveBrandImage, MAX_LOGO_BYTES } from "@/server/images";
import { schoolTag } from "@/lib/public-cache";

// POST /api/settings/logo — upload logo sekolah (ADMIN). PNG/JPG/WEBP <=2MB,
// nama acak, disimpan di /data/uploads/<schoolId>/branding/, diserve publik
// per-sekolah via /api/portal/logo (tanpa login, scope slug).
export async function POST(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const form = await req.formData().catch(() => null);
  const saved = await saveBrandImage({
    file: form?.get("file"),
    dir: "branding",
    subDir: a.school.id,
    maxBytes: MAX_LOGO_BYTES,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });
  const url = `/api/portal/logo`;
  await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.upsert({
      where: { schoolId: a.school.id },
      update: { logoUrl: `logos/${saved.name}` },
      create: { schoolId: a.school.id, logoUrl: `logos/${saved.name}` },
    }),
  );
  await logAuth(a.school.id, "SETTINGS.LOGO", { actorId: a.userId });
  // Logo ikut payload publik (portal/info + /api/portal/logo).
  revalidateTag(schoolTag(a.school.slug), { expire: 0 });
  await purgeEdge([
    `https://${a.school.slug}.${process.env.APEX_DOMAIN ?? "lacakedu.web.id"}/`,
    `https://${a.school.slug}.${process.env.APEX_DOMAIN ?? "lacakedu.web.id"}/privasi`,
  ]);
  return NextResponse.json({ url }, { status: 201 });
}
