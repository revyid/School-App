import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { buildGradebook } from "@/server/gradebook";

// GET /api/gradebook/export?classId=&subjectId= — .xlsx (ADMIN/GURU kelasnya).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["ADMIN", "GURU"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  const subjectId = url.searchParams.get("subjectId")?.slice(0, 64) || null;
  const data = await buildGradebook(a.school.id, a.role, a.userId, classId, subjectId);
  if ("error" in data) return NextResponse.json({ error: data.error }, { status: data.status });
  const XLSX = await import("xlsx");
  const header = ["Nama", "NISN", ...data.tasks.map((t) => `Tugas: ${t.title}`), ...data.assessments.map((x) => `Asesmen: ${x.title}`), "Rata-rata"];
  const aoa: (string | number | null)[][] = [header];
  for (const r of data.rows) {
    aoa.push([
      r.name, r.nisn ?? "",
      ...data.tasks.map((t) => r.taskScores[t.id] ?? null),
      ...data.assessments.map((x) => r.assessScores[x.id] ?? null),
      r.avg ?? null,
    ]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Nilai");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="gradebook.xlsx"',
      "x-content-type-options": "nosniff",
    },
  });
}
