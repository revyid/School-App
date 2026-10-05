import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { buildGradebook } from "@/server/gradebook";

// GET /api/gradebook?classId=&subjectId= — agregasi skor tugas + asesmen per siswa.
// GURU: kelasnya. ADMIN: semua. PDF ditunda (baru .xlsx via /export).
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
  return NextResponse.json(data);
}
