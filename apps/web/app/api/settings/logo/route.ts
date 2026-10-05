import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { detectImage, MAX_LOGO_BYTES } from "@/server/images";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";

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
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_LOGO_BYTES) return NextResponse.json({ error: "file melebihi 2MB" }, { status: 400 });
  const kind = detectImage(buf);
  if (!kind) return NextResponse.json({ error: "file bukan gambar PNG/JPG/WEBP valid" }, { status: 400 });
  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  const dir = `${root()}/${a.school.id}/branding`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${name}`, buf);
  const url = `/api/portal/logo`;
  await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.upsert({
      where: { schoolId: a.school.id },
      update: { logoUrl: `logos/${name}` },
      create: { schoolId: a.school.id, logoUrl: `logos/${name}` },
    }),
  );
  await logAuth(a.school.id, "SETTINGS.LOGO", { actorId: a.userId });
  return NextResponse.json({ url }, { status: 201 });
}
