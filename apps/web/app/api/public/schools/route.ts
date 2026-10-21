import { NextResponse } from "next/server";
import { db } from "@sms/db/client";

// GET /api/public/schools — direktori publik untuk landing platform.
// Hanya kolom direktori (id/slug/nama); School tidak memuat data pribadi.
export async function GET() {
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const schools = await db.school.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    schools: schools.map((s) => ({ ...s, url: `https://${s.slug}.${apex}` })),
    total: schools.length,
  });
}
