import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { classSchema } from "@sms/shared/master";
import { paginationSchema } from "@sms/shared/master";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles,
  });
}

export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const p = paginationSchema.safeParse({
    page: new URL(req.url).searchParams.get("page") ?? undefined,
    perPage: new URL(req.url).searchParams.get("perPage") ?? undefined,
  });
  const page = p.success ? p.data.page : 1;
  const perPage = p.success ? p.data.perPage : 50;
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.class.findMany({
      include: {
        homeroomTeacher: { select: { id: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  );
  const total = await runAsSchool(db, a.school.id, (tx) => tx.class.count());
  return NextResponse.json({ rows, page, perPage, total });
}

export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = classSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  if (body.data.homeroomTeacherId) {
    const t = await runAsSchool(db, a.school.id, (tx) =>
      tx.user.findFirst({ where: { id: body.data.homeroomTeacherId!, role: "GURU" } }),
    );
    if (!t) return NextResponse.json({ error: "wali kelas harus guru sekolah ini" }, { status: 400 });
  }
  try {
    const row = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.create({
        data: { schoolId: a.school.id, name: body.data.name, gradeLevel: body.data.gradeLevel ?? null, homeroomTeacherId: body.data.homeroomTeacherId ?? null },
      }),
    );
    await logAuth(a.school.id, "CLASS.CREATE", { actorId: a.userId, meta: { classId: row.id } });
    return NextResponse.json({ row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "nama kelas sudah dipakai" }, { status: 409 });
  }
}
