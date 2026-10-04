import { stat, readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { assessImgPath } from "@/server/assess-files";

// GET /api/assess-files/[qid]/[name] — gambar soal.
// SISWA: hanya bila soal bagian dari asesmen yang visible untuknya (publishAt lewat + kelasnya).
// GURU: soal bank miliknya ATAU snapshot asesmen miliknya. ADMIN: semua di sekolahnya.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qid: string; name: string }> },
) {
  const host = req.headers.get("host") ?? "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const a = await requireRole({
    host, token, pathname: new URL(req.url).pathname, roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { qid, name } = await params;
  const id = qid.slice(0, 64);

  if (a.role === "SISWA") {
    const prof = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (!prof?.classId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const sClassId: string = prof.classId;
    const ok = await runAsSchool(db, a.school.id, (tx) =>
      tx.assessQuestion.findFirst({
        where: {
          id,
          assessment: { classId: sClassId, publishAt: { lte: new Date() } },
        },
        select: { id: true },
      }));
    if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } else if (a.role === "GURU") {
    const snap = await runAsSchool(db, a.school.id, (tx) =>
      tx.assessQuestion.findFirst({
        where: { id, assessment: { authorId: a.userId } },
        select: { id: true },
      }));
    const bank = snap ? null : await runAsSchool(db, a.school.id, (tx) =>
      tx.question.findFirst({ where: { id, authorId: a.userId }, select: { id: true } }));
    if (!snap && !bank) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let abs: string;
  try {
    abs = assessImgPath(a.school.id, name.slice(0, 255));
  } catch {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }
  let st;
  try {
    st = await stat(abs);
  } catch {
    return NextResponse.json({ error: "file tidak ditemukan" }, { status: 404 });
  }
  const buf = await readFile(abs);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": name.endsWith(".png") ? "image/png" : "image/jpeg",
      "content-length": String(st.size),
      "content-disposition": 'inline; filename="soal"',
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
