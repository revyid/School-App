import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import * as XLSX from "xlsx";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    roles: ["ADMIN"],
  });
}

// GET /api/attendance/monthly?month=YYYY-MM&classId=&format=xlsx — rekap bulanan.
// Kolom: Nama, NISN, HADIR, IZIN, SAKIT, ALPHA, Tanpa Ket./BELUM.
export async function GET(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const url = new URL(req.url);
  const m = /^(\d{4})-(\d{2})$/.exec((url.searchParams.get("month") ?? "").slice(0, 7));
  const classId = (url.searchParams.get("classId") ?? "").slice(0, 64);
  if (!m || !classId) return NextResponse.json({ error: "month & classId wajib diisi" }, { status: 400 });
  const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));

  const students = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { classId },
      include: { user: { select: { id: true, name: true, nisn: true } } },
      orderBy: { user: { name: "asc" } },
      take: 500,
    }),
  );
  const recs = await runAsSchool(db, a.school.id, (tx) =>
    tx.attendanceRecord.findMany({
      where: { classId, date: { gte: from, lt: to } },
      select: { studentId: true, status: true },
      take: 5000,
    }),
  );
  const per: Map<string, { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number }> = new Map();
  for (const r of recs) {
    const e = per.get(r.studentId) ?? { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    e[r.status as "HADIR" | "IZIN" | "SAKIT" | "ALPHA"]++;
    per.set(r.studentId, e);
  }
  // Hari efektif: hitung dari kalender (hari tanpa LIBUR global). Sederhana: total hari
  // dalam bulan dikurangi LIBUR global — tanpa jadwal per kelas (cukup untuk rekap).
  const daysInMonth = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const libur = await runAsSchool(db, a.school.id, (tx) =>
    tx.academicCalendar.findMany({
      where: { date: { gte: from, lt: to }, kind: "LIBUR", classId: null },
      select: { date: true },
    }),
  );
  const efektif = daysInMonth - libur.length;

  const rows = students.map((s) => {
    const e = per.get(s.user.id) ?? { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    return {
      Nama: s.user.name,
      NISN: s.user.nisn ?? "-",
      Hadir: e.HADIR,
      Izin: e.IZIN,
      Sakit: e.SAKIT,
      Alpha: e.ALPHA,
      "Tanpa Catatan": Math.max(0, efektif - e.HADIR - e.IZIN - e.SAKIT - e.ALPHA),
    };
  });
  await logAuth(a.school.id, "ATT.EXPORT_MONTHLY", {
    actorId: a.userId, meta: { month: url.searchParams.get("month"), classId },
  });
  const wb = XLSX.utils.book_new();
  wb.SheetNames.push("Rekap");
  wb.Sheets["Rekap"] = XLSX.utils.json_to_sheet(rows);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="rekap-${m[1]}-${m[2]}.xlsx"`,
      "x-content-type-options": "nosniff",
    },
  });
}
