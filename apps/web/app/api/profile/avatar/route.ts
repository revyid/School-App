import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { saveBrandImage, MAX_AVATAR_BYTES } from "@/server/images";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// POST /api/profile/avatar — upload avatar diri (SISWA saja; User guru/admin
// tidak punya kolom avatar). PNG/JPG/WEBP <=2MB.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const form = await req.formData().catch(() => null);
  const saved = await saveBrandImage({
    file: form?.get("file"),
    dir: "avatars",
    subDir: a.school.id,
    maxBytes: MAX_AVATAR_BYTES,
  });
  if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: saved.status });
  const url = `/api/files/avatar/${saved.name}`;
  await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.upsert({
      where: { userId: a.userId },
      update: { avatarUrl: url },
      create: { schoolId: a.school.id, userId: a.userId, avatarUrl: url },
    }),
  );
  return NextResponse.json({ url }, { status: 201 });
}
