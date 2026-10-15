import { NextRequest, NextResponse } from "next/server";
import { apiGate } from "@/server/api-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { taskInputSchema, isVisibleToStudent, submitState } from "@sms/shared/lms";
import { assertClassAccess, guruClassIds, siswaClassId } from "@/server/lms-scope";
import { notifyTaskChange } from "@/server/task-helpers";

// GET /api/tasks?classId=&status=semua/belum/sudah/terlambat/draf — daftar tugas.
// Guru: hanya kelasnya. Siswa: hanya kelasnya + PUBLISHED + publishAt lewat.
export async function GET(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64) || null;
  const statusF = url.searchParams.get("status") ?? "semua";
  const now = new Date();

  if (a.role === "SISWA") {
    const cid = await siswaClassId(a.school.id, a.userId);
    if (!cid) return NextResponse.json({ rows: [] });
    if (classId && classId !== cid) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    const tasks = await runAsSchool(db, a.school.id, (tx) =>
      tx.task.findMany({
        where: { OR: [{ classId: cid }, { targets: { some: { classId: cid } } }], status: "PUBLISHED", publishAt: { lte: now } },
        include: {
          subject: { select: { name: true } },
          submissions: { where: { studentId: a.userId }, select: { submittedAt: true, score: true } },
          _count: { select: { materials: true, categories: true } },
        },
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        take: 200,
      }),
    );
    const rows = tasks.map((t) => {
      const sub = t.submissions[0] ?? null;
      return {
        id: t.id, title: t.title, type: t.type, deadline: t.deadline, allowLate: t.allowLate,
        subjectName: t.subject?.name ?? null, materials: t._count.materials, categories: t._count.categories,
        isGroup: t.isGroup,
        state: submitState(t, sub?.submittedAt ?? null, now),
        score: sub?.score ?? null,
      };
    }).filter((r) => {
      if (statusF === "belum") return r.state === "BELUM";
      if (statusF === "sudah") return r.state === "SUDAH";
      if (statusF === "terlambat") return r.state === "TERLAMBAT" || r.state === "TUTUP";
      return true;
    });
    return NextResponse.json({ rows });
  }

  // Guru/admin: filter status draf/terjadwal/aktif/selesai + kelas.
  // FASE 3: filter kelas memakai join targets (induk shared bisa muncul di N kelas).
  const targetClassFilter = classId ?? null;
  const where: { status?: "DRAFT" | "PUBLISHED"; OR?: object[] } = {};
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (mine.size === 0) return NextResponse.json({ rows: [] });
    if (classId && !mine.has(classId)) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    const allowed = classId ? [classId] : [...mine];
    where.OR = [{ classId: { in: allowed } }, { targets: { some: { classId: { in: allowed } } } }];
  } else if (classId) {
    where.OR = [{ classId }, { targets: { some: { classId } } }];
  }
  if (statusF === "draf") where.status = "DRAFT";
  if (statusF === "aktif") where.status = "PUBLISHED";

  const tasks = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { name: true } },
        targets: { include: { class: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { submissions: true, materials: true, categories: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  // Bila filter kelas: deadline tampil = deadline per-kelas (target), fallback kolom lama.
  const withTarget = tasks.map((t) => {
    const tg = targetClassFilter ? t.targets.find((x) => x.classId === targetClassFilter) ?? null : null;
    return { ...t, targetForFilter: tg };
  });
  return NextResponse.json({
    rows: withTarget.map((t) => ({
      ...t,
      deadline: t.targetForFilter?.deadline ?? t.deadline,
      publishAt: t.targetForFilter?.publishAt ?? t.publishAt,
      allowLate: t.targetForFilter?.allowLate ?? t.allowLate,
      visible: isVisibleToStudent({ publishAt: t.targetForFilter?.publishAt ?? t.publishAt, deadline: t.targetForFilter?.deadline ?? t.deadline, allowLate: t.targetForFilter?.allowLate ?? t.allowLate, status: (t.targetForFilter as { status?: string } | null)?.status ?? t.status }, now),
      // Label status daftar guru: Draf / Terjadwal / Aktif / Selesai.
      listStatus:
        t.status === "DRAFT" ? "Draf"
        : t.publishAt.getTime() > now.getTime() ? "Terjadwal"
        : t.deadline && t.deadline.getTime() < now.getTime() ? "Selesai"
        : "Aktif",
    })),
  });
}

// POST /api/tasks — GURU/ADMIN buat tugas (D4: judul, kelas, instruksi wajib; lainnya opsional).
// T2: mendukung status DRAFT (wizard) + kategori unggahan + kelompok min/max.
export async function POST(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:task:${a.school.id}:${a.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = taskInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues.slice(0, 3) }, { status: 400 });
  // FASE 3 shared: classTargets (multi-kelas) atau fallback classId tunggal + deadline setingkat.
  const targets: { classId: string; status: string; deadline?: string | null; publishAt?: string | null; allowLate?: boolean }[] =
    (body.data.classTargets?.length ? body.data.classTargets : [{
      classId: body.data.classId,
      status: body.data.status,
      deadline: body.data.deadline ?? null,
      publishAt: body.data.publishAt ?? null,
      allowLate: body.data.allowLate,
    }]);
  const targetClassIds = [...new Set(targets.map((t) => t.classId))];
  if (a.role === "GURU") {
    const chk = await assertClassAccess(a.school.id, a.role, a.userId, targetClassIds);
    if (!chk.ok) return NextResponse.json({ error: chk.error }, { status: chk.status });
  } else {
    for (const cid of targetClassIds) {
      const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: cid } }));
      if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
    }
  }
  if (body.data.subjectId) {
    const s = await runAsSchool(db, a.school.id, (tx) => tx.subject.findUnique({ where: { id: body.data.subjectId! } }));
    if (!s) return NextResponse.json({ error: "mapel tidak ditemukan" }, { status: 400 });
  }

  const { categories, classTargets: _ct, ...taskData } = body.data;
  const primary = targets[0];
  const row = await runAsSchool(db, a.school.id, async (tx) => {
    const task = await tx.task.create({
      data: {
        schoolId: a.school.id,
        classId: primary.classId,
        subjectId: taskData.subjectId ?? null,
        authorId: a.userId,
        title: taskData.title,
        instruction: taskData.instruction,
        type: taskData.type,
        status: taskData.status,
        deadline: primary.deadline ? new Date(primary.deadline) : null,
        publishAt: primary.publishAt ? new Date(primary.publishAt) : new Date(),
        allowLate: primary.allowLate ?? false,
        isGroup: taskData.isGroup,
        groupMin: taskData.groupMin,
        groupMax: taskData.groupMax,
      },
    });
    // FASE 3: satu join per kelas (termasuk kelas utama dari kolom lama via backfill).
    for (const tg of targets) {
      const tgStatus = (tg.status === "DRAFT" ? "DRAFT" : "PUBLISHED") as "DRAFT" | "PUBLISHED";
      await tx.taskTarget.upsert({
        where: { taskId_classId: { taskId: task.id, classId: tg.classId } },
        create: {
          schoolId: a.school.id,
          taskId: task.id,
          classId: tg.classId,
          status: tgStatus,
          deadline: tg.deadline ? new Date(tg.deadline) : null,
          publishAt: tg.publishAt ? new Date(tg.publishAt) : new Date(),
          allowLate: tg.allowLate ?? false,
        },
        update: {
          status: tgStatus,
          deadline: tg.deadline ? new Date(tg.deadline) : null,
          publishAt: tg.publishAt ? new Date(tg.publishAt) : new Date(),
          allowLate: tg.allowLate ?? false,
        },
      });
    }
    const cats = categories?.length
      ? await tx.taskCategory.createManyAndReturn({
          data: categories.map((c, i) => ({
            schoolId: a.school.id,
            taskId: task.id,
            name: c.name,
            instruction: c.instruction ?? null,
            required: c.required,
            accept: c.accept,
            position: c.position ?? i,
          })),
        })
      : [];
    return { task, categories: cats };
  });

  await logAuth(a.school.id, "TASK.CREATE", { actorId: a.userId, meta: { id: row.task.id } });
  // T2: notifikasi ke siswa hanya bila langsung PUBLISHED + publishAt sudah lewat.
  if (row.task.status === "PUBLISHED" && row.task.publishAt.getTime() <= Date.now()) {
    void notifyTaskChange(a.school.id, row.task.id, row.task.classId, "published", row.task.title).catch(() => {});
  }
  return NextResponse.json(row, { status: 201 });
}
