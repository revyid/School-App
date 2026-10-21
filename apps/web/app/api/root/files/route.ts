import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@sms/db/root";

// GET /api/root/files?schoolId= — SUPER_ADMIN: manifest file lintas sekolah
// (dari DB, bukan dari disk). Byte file tetap diserve route per-sekolah.
// Avatar siswa (path /api/files/avatar/...) sengaja tidak dihitung di sini.
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

  const schoolId = (new URL(req.url).searchParams.get("schoolId") ?? "").slice(0, 64);
  const root = getRootDb();
  const [schools, submissions, materials] = await Promise.all([
    root.school.findMany({ select: { id: true, slug: true, name: true } }),
    root.submissionFile.findMany({
      where: schoolId ? { schoolId } : undefined,
      select: { fileName: true, originalName: true, mime: true, size: true, createdAt: true, schoolId: true },
    }),
    root.taskMaterial.findMany({
      where: { ...(schoolId ? { schoolId } : {}), fileName: { not: null } },
      select: { fileName: true, mime: true, size: true, createdAt: true, schoolId: true, isExample: true },
    }),
  ]);
  const schoolById = new Map(schools.map((s) => [s.id, s]));

  const files = [
    ...submissions.map((f) => ({
      fileName: f.fileName,
      originalName: f.originalName,
      size: f.size,
      mime: f.mime,
      purpose: "submission",
      uploadedAt: f.createdAt,
      schoolId: f.schoolId,
    })),
    ...materials.map((f) => ({
      fileName: f.fileName as string,
      originalName: f.fileName as string,
      size: f.size ?? 0,
      mime: f.mime ?? "application/octet-stream",
      purpose: f.isExample ? "material-example" : "material",
      uploadedAt: f.createdAt,
      schoolId: f.schoolId,
    })),
  ]
    .filter((f) => schoolById.has(f.schoolId))
    .sort((x, y) => y.uploadedAt.getTime() - x.uploadedAt.getTime())
    .map(({ schoolId: sid, ...f }) => ({ ...f, school: schoolById.get(sid)! }));

  const totals: Record<string, { files: number; bytes: number }> = {};
  for (const f of files) {
    const t = (totals[f.school.id] ??= { files: 0, bytes: 0 });
    t.files += 1;
    t.bytes += f.size;
  }

  return NextResponse.json({ files, totals });
}
