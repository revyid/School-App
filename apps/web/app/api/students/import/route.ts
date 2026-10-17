import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { resolveDefaultPassword } from "@/server/password";
import * as XLSX from "xlsx";

const ip = (r: NextRequest) => r.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";

// POST /api/students/import — upload .xlsx, parse, validate, insert students.
export async function POST(req: NextRequest) {
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file wajib diisi" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return NextResponse.json({ error: "sheet kosong" }, { status: 400 });

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) return NextResponse.json({ error: "tidak ada data" }, { status: 400 });

  // Fetch existing classes for case-insensitive lookup
  const classes = await runAsSchool(db, a.school.id, (tx) =>
    tx.class.findMany({ where: { schoolId: a.school.id }, select: { id: true, name: true } }),
  );
  const classMap = new Map<string, string>();
  for (const c of classes) classMap.set(normalize(c.name), c.id);

  // Fetch existing NISNs to detect duplicates
  const existingUsers = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findMany({
      where: { schoolId: a.school.id, nisn: { not: null } },
      select: { nisn: true },
    }),
  );
  const existingNisn = new Set(existingUsers.map((u) => String(u.nisn).trim()));

  const rowErrors: { rowNumber: number; errors: string[] }[] = [];
  const validRows: {
    nama: string; nisn: string; gender: string | null; birthDate: Date | null;
    classId: string | null; parentPhone: string | null; pwHash: string; rawPw: string;
  }[] = [];
  const seenNisnInBatch = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const errs: string[] = [];

    const nama = String(row["Nama"] ?? "").trim();
    const nisn = String(row["NISN"] ?? "").trim();
    const jkRaw = String(row["JK"] ?? "").trim();
    const tglLahirRaw = String(row["Tgl Lahir"] ?? "").trim();
    const kelasRaw = String(row["Kelas"] ?? "").trim();
    const noOrtuRaw = String(row["No Ortu"] ?? "").trim();

    if (!nama) errs.push("Nama wajib diisi");
    if (!nisn) errs.push("NISN wajib diisi");

    if (nisn) {
      if (existingNisn.has(nisn)) errs.push(`NISN ${nisn} sudah terdaftar di sekolah`);
      if (seenNisnInBatch.has(nisn)) errs.push(`NISN ${nisn} duplikat di file ini`);
      seenNisnInBatch.add(nisn);
    }

    let gender: string | null = null;
    if (jkRaw) {
      const upper = jkRaw.toUpperCase();
      if (upper === "L" || upper === "P") gender = upper;
      else errs.push(`JK tidak valid: "${jkRaw}" (harus L atau P)`);
    }

    let birthDate: Date | null = null;
    if (tglLahirRaw) {
      const d = parseDate(tglLahirRaw);
      if (d) birthDate = d;
      else errs.push(`Tgl Lahir tidak valid: "${tglLahirRaw}"`);
    }

    let classId: string | null = null;
    if (kelasRaw) {
      const cid = classMap.get(normalize(kelasRaw));
      if (cid) classId = cid;
      else {
        const available = classes.map((c) => c.name).join(", ");
        errs.push(`Kelas "${kelasRaw}" tidak ditemukan. Kelas tersedia: ${available || "(belum ada)"}`);
      }
    }

    const parentPhone = noOrtuRaw || null;

    if (errs.length) {
      rowErrors.push({ rowNumber: rowNum, errors: errs });
    } else {
      const { password: rawPw } = await resolveDefaultPassword(a.school.id, nisn);
      const pwHash = await argon2.hash(rawPw, { type: argon2.argon2id });
      validRows.push({ nama, nisn, gender, birthDate, classId, parentPhone, pwHash, rawPw });
    }
  }

  const batch = await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.create({
      data: {
        schoolId: a.school.id,
        createdById: a.userId,
        fileName: file.name,
        status: "PROCESSING",
        totalRows: rows.length,
      },
    }),
  );

  let okCount = 0;
  const credentials: { nisn: string; name: string; password: string }[] = [];

  for (const vr of validRows) {
    try {
      await runAsSchool(db, a.school.id, async (tx) => {
        const u = await tx.user.create({
          data: {
            schoolId: a.school.id,
            role: "SISWA",
            name: vr.nama,
            nisn: vr.nisn,
            passwordHash: vr.pwHash,
            mustChangePassword: true,
            passwordChangedAt: new Date(),
          },
        });
        await tx.studentProfile.create({
          data: {
            schoolId: a.school.id,
            userId: u.id,
            classId: vr.classId,
            parentPhone: vr.parentPhone,
            gender: vr.gender,
            birthDate: vr.birthDate,
          },
        });
        await tx.studentQr.create({
          data: {
            schoolId: a.school.id,
            studentId: u.id,
            token: `sms1-${randomBytes(16).toString("hex")}`,
          },
        });
      });
      credentials.push({ nisn: vr.nisn, name: vr.nama, password: vr.rawPw });
      okCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      rowErrors.push({ rowNumber: -1, errors: [`Gagal insert ${vr.nisn}: ${msg}`] });
    }
  }

  await runAsSchool(db, a.school.id, (tx) =>
    tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "DONE",
        processedRows: rows.length,
        okRows: okCount,
        errRows: rowErrors.length,
        errorReport: { rowErrors, credentials },
      },
    }),
  );

  await logAuth(a.school.id, "IMPORT.STUDENTS", {
    actorId: a.userId, ip: ip(req),
    meta: { batchId: batch.id, total: rows.length, ok: okCount, err: rowErrors.length },
  });

  return NextResponse.json({
    batchId: batch.id,
    total: rows.length,
    ok: okCount,
    errors: rowErrors.length,
  });
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

function parseDate(s: string): Date | null {
  const num = Number(s);
  if (!isNaN(num) && num > 25568 && num < 100000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return new Date(`${a}-${b}-${c}`);
    return new Date(`${c}-${b}-${a}`);
  }
  return null;
}
