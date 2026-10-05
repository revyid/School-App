import { createReadStream, promises as fsp } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

const root = () => process.env.UPLOADS_ROOT ?? "/data/uploads";
const SAFE = /^[a-f0-9]{32}\.(png|jpg|webp)$/;

// GET /api/files/avatar/:name — avatar milik sendiri, atau ADMIN/wali/guru pengajar.
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { name } = await params;
  if (!SAFE.test(name)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const owner = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findFirst({
      where: { avatarUrl: `/api/files/avatar/${name}` },
      select: { userId: true, classId: true },
    }),
  );
  if (!owner) return NextResponse.json({ error: "not found" }, { status: 404 });
  let allowed = a.role === "ADMIN" || owner.userId === a.userId;
  if (!allowed && a.role === "GURU" && owner.classId) {
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findFirst({ where: { teacherId: a.userId, classId: owner.classId! } }),
    );
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findFirst({ where: { id: owner.classId!, homeroomTeacherId: a.userId } }),
    );
    allowed = !!(mine || homeroom);
  }
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const path = `${root()}/${a.school.id}/avatars/${name}`;
  try {
    await fsp.access(path);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const stream = createReadStream(path);
  const ext = name.split(".").pop();
  const ct = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "content-type": ct,
      "content-disposition": `inline; filename="${name}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=86400",
    },
  });
}
