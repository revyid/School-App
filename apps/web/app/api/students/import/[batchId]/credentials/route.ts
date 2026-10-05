import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import * as XLSX from "xlsx";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

// GET /api/students/import/:batchId/credentials — unduh daftar kredensial SEKALI.
// Setelah diunduh, flag credentialsDownloaded=true dan endpoint mengembalikan 410.
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const { batchId } = await params;
  const batch = await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.findUnique({ where: { id: batchId } }),
  );
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (batch.status !== "DONE") return NextResponse.json({ error: "batch belum selesai" }, { status: 409 });
  const report = (batch.errorReport ?? {}) as {
    credentials?: { nisn: string; name: string; password: string }[];
    credentialsDownloaded?: boolean;
  };
  if (report.credentialsDownloaded) {
    return NextResponse.json({ error: "daftar kredensial sudah pernah diunduh" }, { status: 410 });
  }
  const creds = report.credentials ?? [];
  const wb = XLSX.utils.book_new();
  wb.SheetNames.push("Kredensial");
  wb.Sheets["Kredensial"] = XLSX.utils.json_to_sheet(
    creds.map((c) => ({ NISN: c.nisn, Nama: c.name, Password: c.password })),
  );
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.update({
      where: { id: batchId },
      data: { errorReport: { ...report, credentials: [], credentialsDownloaded: true } },
    }),
  );
  await logAuth(a.school.id, "IMPORT.CREDENTIALS_DOWNLOAD", {
    actorId: a.userId, ip: ip(req), meta: { batchId, count: creds.length },
  });
  return new NextResponse(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="import-credentials-${batchId}.xlsx"`,
      "x-content-type-options": "nosniff",
    },
  });
}
