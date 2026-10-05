import { NextRequest, NextResponse } from "next/server";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { schoolSlugFromHost } from "@sms/shared/school";

// GET /api/portal/info — publik (tanpa login): nama, lat/lng, CTA, pengumuman ALL.
// Scope via runAsSchool(schoolId dari slug): tenant_isolation tetap berlaku per sekolah.
export async function GET(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "domainmu.id");
  if (!slug) return NextResponse.json({ error: "not found" }, { status: 404 });
  const school = await db.school.findFirst({
    where: { slug },
    select: { id: true, name: true, lat: true, lng: true },
  });
  if (!school) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sid = school.id;
  const s = await runAsSchool(db, sid, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId: sid } }));
  const now = new Date();
  const announcements = await runAsSchool(db, sid, (tx) =>
    tx.announcement.findMany({
      where: { target: "ALL", publishAt: { lte: now } },
      select: { id: true, title: true, body: true, publishAt: true },
      orderBy: { publishAt: "desc" },
      take: 20,
    }));
  // Agregat publik non-sensitif: hitungan warga + daftar mapel (nama saja).
  const [studentCount, teacherCount, classCount, subjects] = await Promise.all([
    runAsSchool(db, sid, (tx) => tx.studentProfile.count()),
    runAsSchool(db, sid, (tx) => tx.user.count({ where: { role: "GURU", isActive: true } })),
    runAsSchool(db, sid, (tx) => tx.class.count()),
    runAsSchool(db, sid, (tx) =>
      tx.subject.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 8 })),
  ]);
  return NextResponse.json({
    school: { name: school.name, lat: school.lat, lng: school.lng },
    portalName: s?.portalName || school.name,
    logoUrl: s?.logoUrl ? "/api/portal/logo" : null,
    ctaGtkUrl: s?.ctaGtkUrl ?? null,
    ctaMuridUrl: s?.ctaMuridUrl ?? null,
    announcements,
    counts: { students: studentCount, teachers: teacherCount, classes: classCount },
    subjects,
  });
}
