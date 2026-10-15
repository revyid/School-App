import { NextRequest, NextResponse } from "next/server";
import { apiGate } from "@/server/api-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/assignments?teacherId&classId — ADMIN/GURU (READ-ONLY).
// Penugasan dibaca LIVE dari TimetableSlot (shared data): distinct pasangan
// guru–kelas + mapel tersering per pasangan. Format rows dipertahankan:
// { id: "<teacherId>:<classId>", subject, teacher: {id,name}, class: {id,name} }.
export async function GET(req: NextRequest) {
  const a = await apiGate(req, ["ADMIN", "GURU"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const teacherId = (url.searchParams.get("teacherId") ?? "").slice(0, 64);
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  if (a.role === "GURU" && teacherId && teacherId !== a.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const slots = await runAsSchool(db, a.school.id, (tx) =>
    tx.timetableSlot.findMany({
      where: {
        ...(teacherId ? { teacherId } : a.role === "GURU" ? { teacherId: a.userId } : {}),
        ...(classId ? { classId } : {}),
      },
      include: {
        teacher: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        subjectRef: { select: { name: true } },
      },
      orderBy: { class: { name: "asc" } },
      take: 2000,
    }),
  );
  const groups = new Map<string, {
    teacherId: string; teacherName: string;
    classId: string; className: string;
    names: Map<string, number>;
  }>();
  for (const s of slots) {
    if (!s.teacherId || !s.teacher) continue;
    const key = `${s.teacherId}${s.classId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        teacherId: s.teacherId, teacherName: s.teacher.name,
        classId: s.classId, className: s.class.name,
        names: new Map(),
      };
      groups.set(key, g);
    }
    const nm = (s.subjectRef?.name ?? s.subjectName ?? "").trim();
    if (nm) g.names.set(nm, (g.names.get(nm) ?? 0) + 1);
  }
  const rows = [...groups.values()].map((g) => ({
    id: `${g.teacherId}:${g.classId}`,
    subject: [...g.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
    teacher: { id: g.teacherId, name: g.teacherName },
    class: { id: g.classId, name: g.className },
  }));
  return NextResponse.json({ rows });
}
