import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { saveImportFile } from "@/server/uploads";
import { enqueueImport } from "@/server/queue";
import { paginationSchema } from "@sms/shared/master";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

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

// GET /api/students?page&perPage&q&classId — ADMIN/GURU (SISWA ditolak).
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const p = paginationSchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    perPage: url.searchParams.get("perPage") ?? undefined,
    q: url.searchParams.get("q") ?? "",
  });
  if (!p.success) return NextResponse.json({ error: "parameter tidak valid" }, { status: 400 });
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  const { page, perPage, q } = p.data;
  let classIds: string[] | undefined;
  if (a.role === "GURU") {
    // GURU hanya melihat siswa di kelas yang diajar/diampu.
    const mine = await runAsSchool(db, a.school.id, (tx) =>
      tx.teacherClass.findMany({ where: { teacherId: a.userId }, select: { classId: true } }),
    );
    const homeroom = await runAsSchool(db, a.school.id, (tx) =>
      tx.class.findMany({ where: { homeroomTeacherId: a.userId }, select: { id: true } }),
    );
    classIds = [...new Set([...mine.map((m) => m.classId), ...homeroom.map((h) => h.id)])];
    if (classId && !classIds.includes(classId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const whereClass = classId || (classIds ? { in: classIds } : undefined);
  const rows = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: {
        ...(whereClass ? { classId: whereClass } : {}),
        ...(q
          ? {
              OR: [
                { user: { name: { contains: q, mode: "insensitive" } } },
                { user: { nisn: { contains: q } } },
              ],
            }
          : {}),
      },
      include: { user: { select: { id: true, name: true, nisn: true, email: true, isActive: true } }, class: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  );
  const total = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.count({
      where: {
        ...(whereClass ? { classId: whereClass } : {}),
        ...(q
          ? {
              OR: [
                { user: { name: { contains: q, mode: "insensitive" } } },
                { user: { nisn: { contains: q } } },
              ],
            }
          : {}),
      },
    }),
  );
  return NextResponse.json({ rows, page, perPage, total });
}

// POST /api/students/import — ADMIN saja. Body: multipart file=.xlsx -> batch + enqueue.
export async function POST(req: NextRequest) {
  const a = await gate(req, ["ADMIN"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const rl = await hit(`rl:import:${a.school.id}:${a.userId}`, 5, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Terlalu banyak upload, coba lagi nanti" }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file .xlsx wajib diunggah" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const batch = await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.create({
      data: { schoolId: a.school.id, createdById: a.userId, fileName: (file.name || "import.xlsx").slice(0, 128) },
    }),
  );
  try {
    await saveImportFile(a.school.id, batch.id, buf);
  } catch (e) {
    await runAsSchool(db, a.school.id, (tx) => tx.importBatch.delete({ where: { id: batch.id } }));
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  await enqueueImport(a.school.id, batch.id);
  await logAuth(a.school.id, "IMPORT.ENQUEUE", { actorId: a.userId, ip: ip(req), meta: { batchId: batch.id } });
  return NextResponse.json({ batchId: batch.id }, { status: 202 });
}
