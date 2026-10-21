import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { buildTimetableTemplate, buildTimetableAllTemplate } from "@/server/timetable-xlsx";

// GET /api/timetable/template[?mode=all] — template .xlsx (ADMIN/GURU).
// Default: per-kelas (Hari|Mulai|Selesai|Mapel|Guru).
// ?mode=all: global (Kelas|Hari|Mulai|Selesai|Mapel|Guru).
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
  const mode = new URL(req.url).searchParams.get("mode");
  const all = mode === "all";
  const buf = all ? buildTimetableAllTemplate() : buildTimetableTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="template-jadwal${all ? "-semua-kelas" : ""}.xlsx"`,
      "x-content-type-options": "nosniff",
    },
  });
}
