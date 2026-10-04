import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import * as XLSX from "xlsx";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

// GET /api/students/import/:batchId/errors — unduh laporan error per baris (.xlsx).
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
    tx.importBatch.findUnique({ where: { id: batchId } }),
  );
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (batch.status !== "DONE") return NextResponse.json({ error: "batch belum selesai" }, { status: 409 });
  const report = (batch.errorReport ?? {}) as { rowErrors?: { rowNumber: number; errors: string[] }[] };
  const rows = (report.rowErrors ?? []).map((e) => ({
    "Baris Excel": e.rowNumber,
    Error: e.errors.join("; "),
  }));
  const wb = XLSX.utils.book_new();
  wb.SheetNames.push("Error");
  wb.Sheets["Error"] = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Baris Excel": "-", Error: "tidak ada error" }]);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await logAuth(a.school.id, "IMPORT.ERRORS_DOWNLOAD", { actorId: a.userId, ip: ip(req), meta: { batchId } });
  return new NextResponse(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="import-errors-${batchId}.xlsx"`,
      "x-content-type-options": "nosniff",
    },
  });
}
