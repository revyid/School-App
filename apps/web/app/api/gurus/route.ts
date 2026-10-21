import { NextRequest, NextResponse } from "next/server";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/gurus — publik: daftar guru aktif + mapel + email (tanpa login).
// Dipakai halaman /anonim untuk memilih penerima "Pesan baru".
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = (await import("@sms/shared/school")).schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });

  const school = await db.school.findFirst({ where: { slug }, select: { id: true } });
  if (!school) return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });

  const rows = await runAsSchool(db, school.id, (tx) =>
    tx.user.findMany({
      where: { schoolId: school.id, role: "GURU", isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  );

  // Mapel (subject) dari TimetableSlot.
  const g = rows.map((r) => r.id);
  const subjects = new Map<string, string[]>();
  if (g.length > 0) {
    const slots = await runAsSchool(db, school.id, (tx) =>
      tx.timetableSlot.findMany({
        where: { teacherId: { in: g } },
        select: { teacherId: true, subjectName: true, subjectRef: { select: { name: true } } },
      }),
    );
    for (const s of slots) {
      if (!s.teacherId) continue;
      const nm = (s.subjectRef?.name ?? s.subjectName ?? "").trim();
      if (!nm) continue;
      let list = subjects.get(s.teacherId);
      if (!list) { list = []; subjects.set(s.teacherId, list); }
      if (!list.includes(nm)) list.push(nm);
    }
    for (const list of subjects.values()) list.sort();
  }

  const teachers = rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    subjects: subjects.get(r.id) ?? [],
  }));

  return NextResponse.json({ teachers });
}
