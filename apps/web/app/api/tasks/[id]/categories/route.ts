import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { categoryInputSchema } from "@sms/shared/lms";
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

// POST /api/tasks/[id]/categories — tambah kategori unggahan (T2/D3).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { id } = await params;
  const rl = await hit(`rl:taskcat:${a.school.id}:${a.userId}`, 60, 60);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu sering, coba lagi nanti" }, { status: 429 });
  const t = await runAsSchool(db, a.school.id, (tx) =>
    tx.task.findUnique({ where: { id: id.slice(0, 64) }, select: { id: true, classId: true, authorId: true } }));
  if (!t) return NextResponse.json({ error: "tugas tidak ditemukan" }, { status: 404 });
  if (!(await canManageTask(a.school.id, a.userId, a.role, t))) {
    return NextResponse.json({ error: "bukan tugas kelas Anda" }, { status: 403 });
  }
  const body = categoryInputSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  const count = await runAsSchool(db, a.school.id, (tx) => tx.taskCategory.count({ where: { taskId: t.id } }));
  const row = await runAsSchool(db, a.school.id, (tx) =>
    tx.taskCategory.create({
      data: {
        schoolId: a.school.id,
        taskId: t.id,
        name: body.data.name,
        instruction: body.data.instruction ?? null,
        required: body.data.required,
        accept: body.data.accept,
        position: body.data.position ?? count,
      },
    }));
  await logAuth(a.school.id, "TASK.CATEGORY_ADD", { actorId: a.userId, meta: { taskId: t.id, categoryId: row.id } });
  return NextResponse.json({ category: row }, { status: 201 });
}
