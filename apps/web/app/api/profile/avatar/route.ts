import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { detectImage, MAX_AVATAR_BYTES } from "@/server/images";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";

// POST /api/profile/avatar — upload avatar diri (SISWA/GURU/ADMIN). PNG/JPG/WEBP <=2MB.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file wajib diunggah" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_AVATAR_BYTES) return NextResponse.json({ error: "file melebihi 2MB" }, { status: 400 });
  const kind = detectImage(buf);
  if (!kind) return NextResponse.json({ error: "file bukan gambar PNG/JPG/WEBP valid" }, { status: 400 });
  const name = `${randomBytes(16).toString("hex")}.${kind}`;
  const dir = `${root()}/${a.school.id}/avatars`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/${name}`, buf);
  const url = `/api/files/avatar/${name}`;
  if (a.role === "SISWA") {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.upsert({
        where: { userId: a.userId },
        update: { avatarUrl: url },
        create: { schoolId: a.school.id, userId: a.userId, avatarUrl: url },
      }),
    );
  }
  return NextResponse.json({ url }, { status: 201 });
}
