import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import * as XLSX from "xlsx";

// GET /api/students/import/template — ADMIN saja. Unduh contoh .xlsx
// dengan header persis seperti yang dibaca worker (Nama, JK, NISN,
// "Tgl Lahir", Kelas, "No Ortu") + 2 baris contoh.
const HEADER = ["Nama", "JK", "NISN", "Tgl Lahir", "Kelas", "No Ortu"] as const;
const EXAMPLE = [
  ["Siti Aminah", "P", "1000000001", "2015-03-12", "1A", "6281234567890"],
  ["Budi Santoso", "L", "1000000002", "2015-07-25", "1A", "6289876543210"],
] as const;

export async function GET(req: NextRequest) {
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
  const ws = XLSX.utils.aoa_to_sheet([[...HEADER], ...EXAMPLE.map((r) => [...r])]);
  ws["!cols"] = [{ wch: 22 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-impor-siswa.xlsx"',
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buf.length),
    },
  });
}
