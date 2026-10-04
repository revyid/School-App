import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// GET /api/students/import/:batchId — ADMIN: status + progress polling.
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { batchId } = await params;
  const batch = await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.findUnique({
      where: { id: batchId },
      select: {
        id: true, fileName: true, status: true, totalRows: true,
        processedRows: true, okRows: true, errRows: true, createdAt: true,
      },
    }),
  );
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ batch });
}
