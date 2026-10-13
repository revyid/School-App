import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { buildTimetableTemplate } from "@/server/timetable-xlsx";

// GET /api/timetable/template — template .xlsx format sendiri (ADMIN/GURU).
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
  const buf = buildTimetableTemplate();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="template-jadwal.xlsx"',
      "x-content-type-options": "nosniff",
    },
  });
}
