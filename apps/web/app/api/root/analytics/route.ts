import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";

// GET /api/root/analytics?range=7|30|90&schoolId=<id>
// SUPER_ADMIN: agregat platform (opsional difilter per sekolah).
const RANGES = [7, 30, 90] as const;

type SchoolRow = { id: string; name: string; slug: string };

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

  const url = new URL(req.url);
  const rawRange = Number(url.searchParams.get("range"));
  const range = (RANGES as readonly number[]).includes(rawRange) ? rawRange : 30;
  const schoolFilter = url.searchParams.get("schoolId")?.trim() || null;

  const root = getRootDb();
  const schools: SchoolRow[] = await root.school.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  // Filter sekolah: kalau tak ada, semua sekolah (id array -> index-friendly).
  const ids = schoolFilter ? schools.filter((s) => s.id === schoolFilter).map((s) => s.id) : schools.map((s) => s.id);
  if (schoolFilter && ids.length === 0)
    return NextResponse.json({ error: "sekolah tidak ditemukan" }, { status: 404 });

  // Agregat berat -> di-cache 60 detik. Kunci cache ikut range + sekolah,
  // jadi filter per sekolah tidak saling menimpa.
  const cache = unstable_cache(
    async (rangeDays: number, schoolIds: string[], schoolRows: SchoolRow[]) => {
      const [
        user,
        student,
        teacher,
        classCount,
        task,
        submission,
        assessment,
        material,
        book,
        announcement,
        collabThread,
        aiMessage,
        attendanceTotal,
        leaveTotal,
        leavePending,
        attendanceByDay,
        leaveByDay,
        viewsByDay,
        newUsersByDay,
        perSchool,
        perSchoolUsers,
        perSchoolClasses,
        perSchoolBooks,
        perSchoolViews,
        waQueue,
      ] = await Promise.all([
        root.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
        root.studentProfile.count(),
        root.user.count({ where: { role: "GURU" } }),
        root.class.count(),
        root.task.count(),
        root.submission.count(),
        root.assessment.count(),
        root.taskMaterial.count(),
        root.book.count(),
        root.announcement.count(),
        root.collabThread.count(),
        root.aiChatMessage.count(),
        root.attendanceRecord.count({ where: { date: { gte: daysAgo(rangeDays) } } }),
        root.leaveRequest.count({ where: { date: { gte: daysAgo(rangeDays) } } }),
        root.leaveRequest.count({ where: { status: "PENDING" } }),
        // Absensi nyata per hari + jumlah hadir.
        root.$queryRaw<{ date: string; value: number; present: number }[]>`
          SELECT to_char(date_trunc('day', "date"), 'YYYY-MM-DD') AS date,
                 COUNT(*)::int AS value,
                 COUNT(*) FILTER (WHERE status = 'HADIR')::int AS present
          FROM "AttendanceRecord"
          WHERE "date" >= current_date - (${rangeDays} - 1) * interval '1 day'
            AND "schoolId" = ANY(${schoolIds}::text[])
          GROUP BY 1 ORDER BY 1`,
        // Izin per hari.
        root.$queryRaw<{ date: string; value: number; pending: number }[]>`
          SELECT to_char(date_trunc('day', "date"), 'YYYY-MM-DD') AS date,
                 COUNT(*)::int AS value,
                 COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending
          FROM "LeaveRequest"
          WHERE "date" >= current_date - (${rangeDays} - 1) * interval '1 day'
            AND "schoolId" = ANY(${schoolIds}::text[])
          GROUP BY 1 ORDER BY 1`,
        // View per hari.
        root.$queryRaw<{ date: string; value: number }[]>`
          SELECT to_char("day", 'YYYY-MM-DD') AS date, COALESCE(SUM(count), 0)::int AS value
          FROM "ContentView"
          WHERE "day" >= current_date - (${rangeDays} - 1) * interval '1 day'
            AND "schoolId" = ANY(${schoolIds}::text[])
          GROUP BY 1 ORDER BY 1`,
        // Pengguna baru per hari.
        root.$queryRaw<{ date: string; value: number }[]>`
          SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS date, COUNT(*)::int AS value
          FROM "User"
          WHERE "createdAt" >= now() - (${rangeDays} || ' days')::interval
            AND role <> 'SUPER_ADMIN'
            AND ("schoolId" IS NULL OR "schoolId" = ANY(${schoolIds}::text[]))
          GROUP BY 1 ORDER BY 1`,
        // Beban per sekolah dalam rentang.
        root.$queryRaw<
          { schoolId: string; attendance: number; present: number; tasks: number; submissions: number; leaves: number }[]
        >`
          SELECT s.id AS "schoolId",
                 COALESCE(a.cnt, 0)::int AS attendance,
                 COALESCE(a.hadir, 0)::int AS present,
                 COALESCE(t.cnt, 0)::int AS tasks,
                 COALESCE(su.cnt, 0)::int AS submissions,
                 COALESCE(l.cnt, 0)::int AS leaves
          FROM "School" s
          LEFT JOIN (SELECT "schoolId", COUNT(*) cnt, COUNT(*) FILTER (WHERE status='HADIR') hadir FROM "AttendanceRecord"
                     WHERE "date" >= current_date - (${rangeDays} - 1) * interval '1 day' GROUP BY 1) a ON a."schoolId" = s.id
          LEFT JOIN (SELECT "schoolId", COUNT(*) cnt FROM "Task"
                     WHERE "createdAt" >= now() - (${rangeDays} || ' days')::interval GROUP BY 1) t ON t."schoolId" = s.id
          LEFT JOIN (SELECT "schoolId", COUNT(*) cnt FROM "Submission"
                     WHERE "submittedAt" >= now() - (${rangeDays} || ' days')::interval GROUP BY 1) su ON su."schoolId" = s.id
          LEFT JOIN (SELECT "schoolId", COUNT(*) cnt FROM "LeaveRequest"
                     WHERE "date" >= current_date - (${rangeDays} - 1) * interval '1 day' GROUP BY 1) l ON l."schoolId" = s.id
          WHERE s.id = ANY(${schoolIds}::text[])`,
        root.$queryRaw<{ schoolId: string; students: number; teachers: number }[]>`
          SELECT u."schoolId" AS "schoolId",
                 COUNT(*) FILTER (WHERE u.role = 'SISWA')::int AS students,
                 COUNT(*) FILTER (WHERE u.role = 'GURU')::int AS teachers
          FROM "User" u
          WHERE u.role IN ('SISWA','GURU') AND u."schoolId" = ANY(${schoolIds}::text[])
          GROUP BY 1`,
        root.$queryRaw<{ schoolId: string; classes: number }[]>`
          SELECT "schoolId", COUNT(*)::int AS classes FROM "Class"
          WHERE "schoolId" = ANY(${schoolIds}::text[]) GROUP BY 1`,
        root.$queryRaw<{ schoolId: string; books: number }[]>`
          SELECT "schoolId", COUNT(*)::int AS books FROM "Book"
          WHERE "schoolId" = ANY(${schoolIds}::text[]) GROUP BY 1`,
        root.$queryRaw<{ schoolId: string; views: number }[]>`
          SELECT "schoolId", COALESCE(SUM(count), 0)::int AS views FROM "ContentView"
          WHERE "schoolId" = ANY(${schoolIds}::text[]) GROUP BY 1`,
        // Antrean WhatsApp per status.
        root.$queryRaw<{ status: string; cnt: number }[]>`
          SELECT status::text AS status, COUNT(*)::int AS cnt
          FROM "MessageOutbox"
          WHERE "schoolId" = ANY(${schoolIds}::text[])
          GROUP BY 1`,
      ]);

      const bySchool = schoolRows
        .filter((s) => schoolIds.includes(s.id))
        .map((s) => {
          const p = perSchool.find((r) => r.schoolId === s.id);
          const u = perSchoolUsers.find((r) => r.schoolId === s.id);
          const c = perSchoolClasses.find((r) => r.schoolId === s.id);
          const b = perSchoolBooks.find((r) => r.schoolId === s.id);
          const v = perSchoolViews.find((r) => r.schoolId === s.id);
          return {
            id: s.id,
            name: s.name,
            slug: s.slug,
            students: u?.students ?? 0,
            teachers: u?.teachers ?? 0,
            classes: c?.classes ?? 0,
            attendance: p?.attendance ?? 0,
            present: p?.present ?? 0,
            tasks: p?.tasks ?? 0,
            submissions: p?.submissions ?? 0,
            leaves: p?.leaves ?? 0,
            books: b?.books ?? 0,
            views: v?.views ?? 0,
          };
        });

      const featureUsage = [
        { kind: "TUGAS", label: "Tugas", value: task },
        { kind: "SUBMISSION", label: "Submission", value: submission },
        { kind: "ASESMEN", label: "Asesmen", value: assessment },
        { kind: "MATERI", label: "Materi", value: material },
        { kind: "BUKU", label: "Buku", value: book },
        { kind: "PENGUMUMAN", label: "Pengumuman", value: announcement },
        { kind: "KOLABORASI", label: "Kolaborasi", value: collabThread },
        { kind: "AI", label: "Pesan AI", value: aiMessage },
      ];

      const wa = { QUEUED: 0, SENDING: 0, SENT: 0, FAILED: 0 };
      for (const r of waQueue) if (r.status in wa) wa[r.status as keyof typeof wa] = r.cnt;

      return {
        counts: {
          user,
          student,
          teacher,
          class: classCount,
          submission,
          task,
          assessment,
          material,
          book,
          announcement,
          collabThread,
          aiMessage,
          attendance: attendanceTotal,
          leaveRequest: leaveTotal,
          leavePending,
        },
        attendanceByDay,
        leaveByDay,
        viewsByDay,
        newUsersByDay,
        bySchool,
        featureUsage,
        wa,
      };
    },
    ["root-analytics"],
    { revalidate: 60, tags: ["root-analytics"] },
  );

  const data = await cache(range, ids, schools);

  return NextResponse.json({
    range,
    schoolId: schoolFilter,
    schools,
    ...data,
  });
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
