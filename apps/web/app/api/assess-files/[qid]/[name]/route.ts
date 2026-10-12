import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { serveFile } from "@/server/files";

// GET /api/assess-files/[qid]/[name]?inline=1 — gambar/video soal.
// SISWA: hanya bila soal bagian dari asesmen yang visible untuknya.
// GURU: snapshot asesmen miliknya ATAU soal bank miliknya. ADMIN: semua.
// A6: nama file WAJIB cocok dengan imageName/videoName milik soal [qid]
// (sebelumnya hanya cek akses soal — nama file sembarangan diterima).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ qid: string; name: string }> },
) {
  const host = req.headers.get("host") ?? "";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const a = await requireRole({
    host, token, pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"), roles: ["ADMIN", "GURU", "SISWA"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { qid, name } = await params;
  const id = qid.slice(0, 64);
  const fileName = name.slice(0, 160);
  if (fileName.includes("/") || fileName.includes("..")) {
    return NextResponse.json({ error: "nama file tidak valid" }, { status: 400 });
  }

  // Ambil soal + cocokkan nama file dengan media miliknya.
  const snap = await runAsSchool(db, a.school.id, (tx) =>
    tx.assessQuestion.findFirst({
      where: { id },
      select: { id: true, imageName: true, videoName: true, assessment: { select: { classId: true, publishAt: true, authorId: true } } },
    }));
  let bank: { id: string; imageName: string | null; videoName: string | null; authorId: string } | null = null;
  if (!snap) {
    bank = await runAsSchool(db, a.school.id, (tx) =>
      tx.question.findFirst({ where: { id }, select: { id: true, imageName: true, videoName: true, authorId: true } }));
  }
  if (!snap && !bank) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // A6: nama harus persis milik soal ini — cegah akses file lintas soal.
  const ownName = snap ? (snap.imageName === fileName || snap.videoName === fileName) : (bank!.imageName === fileName || bank!.videoName === fileName);
  if (!ownName) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (a.role === "SISWA") {
    if (!snap) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const prof = await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.findUnique({ where: { userId: a.userId }, select: { classId: true } }));
    if (!prof?.classId || snap.assessment.classId !== prof.classId || snap.assessment.publishAt > new Date()) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (a.role === "GURU") {
    const mine = snap ? snap.assessment.authorId === a.userId : bank!.authorId === a.userId;
    if (!mine) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // F6: streaming + Range (video soal bisa di-seek) + inline.
  return serveFile(
    [a.school.id, "assess"],
    fileName,
    req.headers.get("range"),
    { inline: true },
  );
}
