import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { taskInputSchema, isVisibleToStudent, submitState } from "@sms/shared/lms";
import { guruClassIds, siswaClassId } from "@/server/lms-scope";
import { notifyTaskChange } from "@/server/task-helpers";

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

// GET /api/tasks?classId=&status=semua/belum/sudah/terlambat/draf — daftar tugas.
// Guru: hanya kelasnya. Siswa: hanya kelasnya + PUBLISHED + publishAt lewat.
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
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
        where: { classId: cid, status: "PUBLISHED", publishAt: { lte: now } },
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
  const where: { classId?: string | { in: string[] }; status?: "DRAFT" | "PUBLISHED" } = {};
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (mine.size === 0) return NextResponse.json({ rows: [] });
    if (classId && !mine.has(classId)) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
    where.classId = classId ?? { in: [...mine] };
  } else if (classId) {
    where.classId = classId;
  }
  if (statusF === "draf") where.status = "DRAFT";
  if (statusF === "aktif") where.status = "PUBLISHED";

  const tasks = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findMany({
      where,
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
        _count: { select: { submissions: true, materials: true, categories: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
  return NextResponse.json({
    rows: tasks.map((t) => ({
      ...t,
      visible: isVisibleToStudent(t, now),
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
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:task:${a.school.id}:${a.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const body = taskInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid", detail: body.error.issues.slice(0, 3) }, { status: 400 });
  if (a.role === "GURU") {
    const mine = await guruClassIds(a.school.id, a.userId);
    if (!mine.has(body.data.classId)) return NextResponse.json({ error: "bukan kelas Anda" }, { status: 403 });
  } else {
    const c = await runAsSchool(db, a.school.id, (tx) => tx.class.findUnique({ where: { id: body.data.classId } }));
    if (!c) return NextResponse.json({ error: "kelas tidak ditemukan" }, { status: 400 });
  }
  if (body.data.subjectId) {
    const s = await runAsSchool(db, a.school.id, (tx) => tx.subject.findUnique({ where: { id: body.data.subjectId! } }));
    if (!s) return NextResponse.json({ error: "mapel tidak ditemukan" }, { status: 400 });
  }

  const { categories, ...taskData } = body.data;
  const row = await runAsSchool(db, a.school.id, async (tx) => {
    const task = await tx.task.create({
      data: {
        schoolId: a.school.id,
        classId: taskData.classId,
        subjectId: taskData.subjectId ?? null,
        authorId: a.userId,
        title: taskData.title,
        instruction: taskData.instruction,
        type: taskData.type,
        status: taskData.status,
        deadline: taskData.deadline ? new Date(taskData.deadline) : null,
        publishAt: taskData.publishAt ? new Date(taskData.publishAt) : new Date(),
        allowLate: taskData.allowLate,
        isGroup: taskData.isGroup,
        groupMin: taskData.groupMin,
        groupMax: taskData.groupMax,
      },
    });
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
