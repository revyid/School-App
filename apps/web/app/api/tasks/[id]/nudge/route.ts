import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { logAuth } from "@/server/audit";
import { nudgeSchema } from "@lacakedu/shared/lms";
import { DEFAULT_TEMPLATES, renderTemplate, formatDeadlineId, normalizePhone } from "@lacakedu/shared/notify";
import { notifyUser } from "@/server/notify";
import { enqueueOutbox } from "@/server/outbox";
import { canManageTask } from "@/server/task-helpers";

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

// POST /api/tasks/[id]/nudge (T7) — pengingat manual per siswa/massal.
// {studentIds?, stage: reminder|deadline|overdue|thanks, inapp, wa}
// Dedupe WA per TAHAP dan JAM (nudge-<tahap>-<task>-<siswa>-<yyyymmddHH>),
// jadi pengingat kedua pada jam berbeda TETAP terkirim (bug lama diperbaiki).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:nudge:${a.school.id}:${a.userId}`, 30, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = nudgeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const { studentIds, stage, inapp: wantInapp, wa: wantWa } = body.data;
  const { id } = await params;

  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({
      where: { id: id.slice(0, 64) },
      select: { id: true, title: true, deadline: true, classId: true, authorId: true, isGroup: true },
    }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }

  // Target: siswa tertentu ATAU seluruh kelas yang belum mengumpulkan (stage != thanks).
  const subs = await runAsSchool(db, a.school.id, (tx) =>
    tx.submission.findMany({ where: { taskId: t.id }, select: { studentId: true, groupId: true } }));
  const doneStudents = new Set(subs.map((s) => s.studentId));
  const doneGroups = new Set(subs.map((s) => s.groupId).filter(Boolean));

  const roster = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: {
        classId: t.classId,
        ...(studentIds?.length ? { user: { id: { in: studentIds } } } : {}),
      },
      select: { user: { select: { id: true, name: true } }, parentPhone: true },
      take: 500,
    }));
  const candidateCount = roster.length;

  let targets = roster;
  if (stage !== "thanks") {
    targets = roster.filter((r) => !doneStudents.has(r.user.id));
    if (t.isGroup) {
      // Kelompok: sudah ada pengumpulan kelompok → semua anggota dianggap selesai.
      const memberships = await runAsSchool(db, a.school.id, (tx) =>
        tx.taskGroupMember.findMany({ where: { taskId: t.id }, select: { studentId: true, groupId: true } }));
      const byStudent = new Map(memberships.map((m) => [m.studentId, m.groupId]));
      targets = targets.filter((r) => {
        const g = byStudent.get(r.user.id);
        return !(g && doneGroups.has(g));
      });
    }
  } else {
    targets = roster.filter((r) => doneStudents.has(r.user.id));
  }
  targets = targets.slice(0, 500);

  const settings = await runAsSchool(db, a.school.id, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: a.school.id }, select: { timezone: true } }));
  const tz = settings?.timezone ?? "Asia/Jakarta";
  const dl = t.deadline ? formatDeadlineId(t.deadline, tz) : "-";

  const hour = new Date();
  const yyyymmddHH = `${hour.getFullYear()}${String(hour.getMonth() + 1).padStart(2, "0")}${String(hour.getDate()).padStart(2, "0")}${String(hour.getHours()).padStart(2, "0")}`;

  const results: { studentId: string; name: string; inapp: string; wa: string }[] = [];
  for (const r of targets) {
    const tpl =
      stage === "deadline" ? DEFAULT_TEMPLATES.stageH3
      : stage === "overdue" ? DEFAULT_TEMPLATES.stageOver
      : stage === "thanks" ? DEFAULT_TEMPLATES.thanks
      : t.deadline && t.deadline.getTime() - Date.now() < 24 * 3600 * 1000 ? DEFAULT_TEMPLATES.stageD1
      : DEFAULT_TEMPLATES.reminder;
    const msg = renderTemplate(tpl, { nama: r.user.name, judul: t.title, deadline: dl });

    let inappState = "skipped";
    if (wantInapp) {
      await notifyUser(a.school.id, r.user.id, stage === "thanks" ? "Terima kasih" : "Pengingat tugas", msg, {
        href: `/siswa/tugas/${t.id}`,
        kind: `task-nudge-${stage}`,
      }).catch(() => {});
      inappState = "sent";
    }

    let waState = "skipped";
    let waReason: string | null = null;
    if (wantWa) {
      // Akar "WA masuk antrean: 0": parentPhone tidak di-select dari roster
      // (selalu no_phone) + nomor mentah tidak dinormalisasi ke 62...
      const norm = r.parentPhone ? normalizePhone(r.parentPhone) : null;
      if (!r.parentPhone) { waState = "no_phone"; waReason = "tanpa nomor ortu"; }
      else if (!norm) { waState = "invalid_phone"; waReason = "nomor ortu tidak valid"; }
      else {
        // Dedupe per tahap + jam: maks 1 pesan per siswa per jam untuk tahap ini.
        const key = `nudge-${stage}-${t.id}-${r.user.id}-${yyyymmddHH}`;
        const res = await enqueueOutbox(a.school.id, norm, msg, key).catch(() => null);
        if (!res) { waState = "wa_offline"; waReason = "antrean WA tidak terjangkau (Redis mati?)"; }
        else if (res.duplicate) { waState = "duplicate"; waReason = "sudah diingatkan tahap ini dalam jam berjalan"; }
        else waState = "queued";
      }
    }
    results.push({ studentId: r.user.id, name: r.user.name, inapp: inappState, wa: waState, ...(waReason ? { waReason } : {}) });
  }
  await logAuth(a.school.id, "TASK.NUDGE", {
    actorId: a.userId,
    meta: { taskId: t.id, stage, count: results.length, wa: results.filter((x) => x.wa === "queued").length },
  });
  return NextResponse.json({
    ok: true,
    results,
    candidateCount,
    summary: {
      total: results.length,
      inappSent: results.filter((x) => x.inapp === "sent").length,
      waQueued: results.filter((x) => x.wa === "queued").length,
      noPhone: results.filter((x) => x.wa === "no_phone").map((x) => x.name),
      skipped: results
        .filter((x) => x.wa !== "queued" && x.wa !== "skipped")
        .map((x) => ({ name: x.name, status: x.wa, alasan: (x as { waReason?: string }).waReason ?? "" })),
      penjelasan:
        candidateCount === 0
          ? "Tidak ada siswa di kelas tugas ini."
          : results.length === 0
            ? stage === "thanks"
              ? "Belum ada yang mengumpulkan — tahap terima kasih butuh minimal 1 pengumpulan."
              : "Semua siswa sudah mengumpulkan — tidak ada target pengingat."
            : undefined,
    },
  });
}
