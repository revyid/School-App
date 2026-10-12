import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { gradeBulkSchema } from "@sms/shared/lms";
import { canManageTask } from "@/server/task-helpers";
import { notifyUser } from "@/server/notify";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
}

// PUT /api/tasks/[id]/grades — bulk grading (T5/T8).
// Tugas kelompok: applyToMembers default true (D1: nilai default untuk semua anggota).
// Notifikasi "Tugas dinilai" dikirim ke siswa pemilik submission (dan anggota kelompok).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const body = gradeBulkSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, authorId: true, title: true, isGroup: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }

  const results: { submissionId: string; ok: boolean; notified: number }[] = [];
  for (const g of body.data.grades) {
    const sub = await runAsSchool(db, a.school.id, (tx) =>
      tx.submission.findUnique({
        where: { id: g.submissionId },
        include: { student: { select: { id: true, name: true } } },
      }));
    if (!sub || sub.taskId !== t.id) {
      results.push({ submissionId: g.submissionId, ok: false, notified: 0 });
      continue;
    }
    await runAsSchool(db, a.school.id, (tx) =>
      tx.submission.update({
        where: { id: sub.id },
        data: { score: g.score, feedback: g.feedback ?? null, gradedById: a.userId, gradedAt: new Date() },
      }));

    // Notifikasi ke pemilik submission.
    let notified = 1;
    await notifyUser(a.school.id, sub.studentId, "Tugas dinilai", `"${t.title}" telah dinilai${g.feedback ? ` — ${g.feedback.slice(0, 100)}` : "."}`, {
      href: `/siswa/tugas/${t.id}`,
      kind: "task-graded",
    }).catch(() => { notified = 0; });

    // Kelompok: nilai sama untuk semua anggota (applyToMembers), kecuali ada override
    // terpisah (baris anggota lain dengan skor sendiri di batch ini).
    if (t.isGroup && sub.groupId && g.applyToMembers) {
      const members = await runAsSchool(db, a.school.id, (tx) =>
        tx.taskGroupMember.findMany({ where: { groupId: sub.groupId! }, select: { studentId: true } }));
      const overridden = new Set(
        body.data.grades
          .filter((x) => x.submissionId !== sub.id)
          .map((x) => x.submissionId),
      );
      const others = members.map((m) => m.studentId).filter((sid) => sid !== sub.studentId);
      // Nilai per-siswa untuk anggota lain disimpan sebagai submission 0-koordinat:
      // kita simpan skor pada kolom submission milik anggota bila ada; jika tidak ada,
      // buat submission "mirror" (skor only, tanpa isi) agar rapor tetap per siswa.
      for (const sid of others) {
        const own = await runAsSchool(db, a.school.id, (tx) =>
          tx.submission.findFirst({ where: { taskId: t.id, studentId: sid } }));
        if (own && !overridden.has(own.id)) {
          await runAsSchool(db, a.school.id, (tx) =>
            tx.submission.update({
              where: { id: own.id },
              data: { score: g.score, feedback: g.feedback ?? null, gradedById: a.userId, gradedAt: new Date() },
            }));
        } else if (!own) {
          await runAsSchool(db, a.school.id, (tx) =>
            tx.submission.create({
              data: {
                schoolId: a.school.id, taskId: t.id, studentId: sid,
                groupId: sub.groupId, submittedById: sub.submittedById,
                text: sub.text, link: sub.link,
                submittedAt: sub.submittedAt, isLate: sub.isLate,
                score: g.score, feedback: g.feedback ?? null, gradedById: a.userId, gradedAt: new Date(),
              },
            }));
        }
        await notifyUser(a.school.id, sid, "Tugas dinilai", `"${t.title}" kelompokmu telah dinilai.`, {
          href: `/siswa/tugas/${t.id}`,
          kind: "task-graded",
        }).catch(() => {});
        notified++;
      }
    }
    results.push({ submissionId: g.submissionId, ok: true, notified });
  }
  await logAuth(a.school.id, "TASK.GRADE_BULK", { actorId: a.userId, meta: { taskId: t.id, count: results.length } });
  return NextResponse.json({ ok: true, results });
}
