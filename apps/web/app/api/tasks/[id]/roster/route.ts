import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { submitState } from "@lacakedu/shared/lms";
import { guruClassIds } from "@/server/lms-scope";

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

// GET /api/tasks/[id]/roster?status=&q=&groupId=&cursor= — T5.
// SATU daftar: semua siswa kelas (pengumpulan + belum), tanpa NISN siswa lain di payload inti.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const url = new URL(req.url);
  const statusF = url.searchParams.get("status") ?? "semua";
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 80);
  const groupId = url.searchParams.get("groupId");
  const cursor = url.searchParams.get("cursor");
  const now = new Date();

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, classId: true, deadline: true, allowLate: true, isGroup: true, publishAt: true, authorId: true, targets: { select: { classId: true } } },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    const ok = mine.has(t.classId) || t.targets.some((x) => mine.has(x.classId));
    if (!ok) return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }

  // Roster: semua siswa kelas + submission-nya (jika ada) + kelompoknya.
  const take = 60;
  const students = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId: t.classId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    }));
  const hasMore = students.length > take;
  const page = hasMore ? students.slice(0, take) : students;

  // Kelompok tugas ini (untuk nama grup di roster).
  const memberships = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskGroupMember.findMany({
      where: { taskId: t.id, ...(groupId ? { groupId } : {}) },
      select: { studentId: true, groupId: true },
    }));
  const groupIds = [...new Set(memberships.map((m) => m.groupId))];
  const groups = groupIds.length
    ? await runAsSchool(db, a.school.id, (tx) =>
        tx.taskGroup.findMany({ where: { id: { in: groupIds } }, select: { id: true, name: true } }))
    : [];
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const groupByStudent = new Map(memberships.map((m) => [m.studentId, groupById.get(m.groupId) ?? null]));

  const subs = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findMany({
      where: { taskId: t.id },
      include: {
        files: { select: { categoryId: true, fileName: true, mime: true, size: true } },
        student: { select: { id: true } },
      },
    }));
  const subByStudent = new Map(subs.map((s) => [s.studentId, s]));

  const rows = page
    .map((p) => {
      const sub = subByStudent.get(p.user.id) ?? null;
      const state = submitState(t, sub?.submittedAt ?? null, now);
      const group = groupByStudent.get(p.user.id) ?? null;
      return {
        student: { id: p.user.id, name: p.user.name },
        submissionId: sub?.id ?? null,
        group: group ? { id: group.id, name: group.name } : null,
        state,
        submittedAt: sub?.submittedAt ?? null,
        isLate: sub?.isLate ?? null,
        files: (sub?.files ?? []).map((f) => ({ categoryId: f.categoryId, name: f.fileName, mime: f.mime, size: f.size })),
        hasText: !!(sub?.text), hasLink: !!(sub?.link),
        score: sub?.score ?? null,
        feedback: sub?.feedback ?? null,
        parent: { hasPhone: !!p.parentPhone },
      };
    })
    .filter((r) => (groupId ? r.group?.id === groupId : true))
    .filter((r) => {
      if (statusF === "sudah") return r.state === "SUDAH" || r.state === "TERLAMBAT";
      if (statusF === "belum") return r.state === "BELUM" || r.state === "TUTUP";
      if (statusF === "terlambat") return r.state === "TERLAMBAT";
      if (statusF === "belum-dinilai") return r.state === "SUDAH" || r.state === "TERLAMBAT";
      return true;
    })
    .filter((r) => (q ? r.student.name.toLowerCase().includes(q) : true));

  const stats = {
    total: students.length,
    done: rows.filter((r) => r.state === "SUDAH").length,
    late: rows.filter((r) => r.state === "TERLAMBAT").length,
    missing: rows.filter((r) => r.state === "BELUM" || r.state === "TUTUP").length,
    avg: rows.filter((r) => r.score != null).length
      ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.filter((r) => r.score != null).length)
      : null,
  };
  return NextResponse.json({ rows, stats, nextCursor: hasMore ? page[page.length - 1].id : null });
}
