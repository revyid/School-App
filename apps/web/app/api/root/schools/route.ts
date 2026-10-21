import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@sms/db/root";

// GET /api/root/schools — SUPER_ADMIN: daftar sekolah + jumlah siswa/guru/kelas.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const root = getRootDb();
  const [schools, students, teachers, classes] = await Promise.all([
    root.school.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: "asc" } }),
    root.studentProfile.groupBy({ by: ["schoolId"], _count: { _all: true } }),
    root.user.groupBy({ by: ["schoolId"], where: { role: "GURU" }, _count: { _all: true } }),
    root.class.groupBy({ by: ["schoolId"], _count: { _all: true } }),
  ]);
  const count = (rows: { schoolId: string | null; _count: { _all: number } }[], id: string) =>
    rows.find((r) => r.schoolId === id)?._count._all ?? 0;

  const rows = schools.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    studentCount: count(students, s.id),
    teacherCount: count(teachers, s.id),
    classCount: count(classes, s.id),
  }));
  return NextResponse.json({ schools: rows, total: rows.length });
}
