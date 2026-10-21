import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";

// GET /api/timetable/subjects?classId= — daftar mapel + guru per kelas
// dari slot jadwal (auto-mapping). Dipakai dropdown form guru + sinkron penugasan.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: false,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN", "GURU"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const classId = (new URL(req.url).searchParams.get("classId") ?? "").slice(0, 64);
  if (!classId) return NextResponse.json({ error: "classId wajib diisi" }, { status: 400 });
  const slots = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where: { classId },
      include: {
        subjectRef: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
      take: 500,
    }),
  );
  const subMap = new Map<string, { id: string | null; name: string }>();
  for (const s of slots) {
    const name = s.subjectRef?.name ?? s.subjectName;
    if (!name.trim()) continue;
    const key = s.subjectId ?? `nama:${name.trim().toLowerCase()}`;
    if (!subMap.has(key)) subMap.set(key, { id: s.subjectId, name: name.trim() });
  }
  const teachMap = new Map<string, { id: string; name: string }>();
  for (const s of slots) {
    if (s.teacherId && s.teacher && !teachMap.has(s.teacherId)) {
      teachMap.set(s.teacherId, { id: s.teacherId, name: s.teacher.name });
    }
  }
  const subjects = [...subMap.values()].sort((x, y) => x.name.localeCompare(y.name, "id"));
  const teachers = [...teachMap.values()].sort((x, y) => x.name.localeCompare(y.name, "id"));
  return NextResponse.json({ subjects, teachers });
}
