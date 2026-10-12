import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { guruClassIds } from "@/server/lms-scope";
import { detectAssessImg, MAX_ASSESS_IMG, saveAssessImg } from "@/server/assess-files";
import { logAuth } from "@/server/audit";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

export async function POST(req: NextRequest) {
  const auth = await gate(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = await hit(`rl:assess-image:${auth.school.id}:${auth.userId}`, 30, 3600);
  if (!limit.ok) return NextResponse.json({ error: "Batas unggah gambar asesmen tercapai. Coba lagi nanti." }, { status: 429 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_ASSESS_IMG + 256 * 1024) {
    return NextResponse.json({ error: "Ukuran gambar maksimal 5 MB." }, { status: 413 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Form unggah tidak valid." }, { status: 400 });
  const classId = String(form.get("classId") ?? "").trim().slice(0, 64);
  const file = form.get("file");
  if (!classId) return NextResponse.json({ error: "Kelas asesmen wajib dipilih." }, { status: 400 });
  if (!file || typeof file === "string") return NextResponse.json({ error: "File gambar wajib dipilih." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_ASSESS_IMG) return NextResponse.json({ error: "Ukuran gambar harus 1 byte–5 MB." }, { status: 413 });
  if (file.type && !["image/jpeg", "image/png"].includes(file.type)) {
    return NextResponse.json({ error: "Format yang didukung hanya JPG/JPEG dan PNG." }, { status: 415 });
  }

  const targetClass = await runAsSchool(db, auth.school.id, (tx) =>
    tx.class.findFirst({ where: { id: classId }, select: { id: true } }));
  if (!targetClass) return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  if (auth.role === "GURU") {
    const allowed = await guruClassIds(auth.school.id, auth.userId);
    if (!allowed.has(classId)) return NextResponse.json({ error: "Anda tidak mengajar kelas ini." }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!detectAssessImg(bytes)) return NextResponse.json({ error: "File bukan gambar JPEG/PNG yang valid." }, { status: 415 });

  let name: string;
  try {
    name = await saveAssessImg(auth.school.id, bytes, auth.userId);
  } catch (cause) {
    console.error("[assessment-image] gagal menyimpan gambar", cause);
    return NextResponse.json({ error: "Gambar gagal disimpan. Coba lagi." }, { status: 500 });
  }
  await logAuth(auth.school.id, "ASSESS.IMAGE_UPLOAD", { actorId: auth.userId, meta: { classId } });
  return NextResponse.json({ name, url: `/api/assessment-images/${name}` }, { status: 201 });
}
