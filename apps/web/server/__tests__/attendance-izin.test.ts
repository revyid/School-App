import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@lacakedu/db/client";
import { dbSystemTest as dbSystem } from "@lacakedu/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@lacakedu/db/tenant";

// Gate dive-mock: tes fokus pada efek DB. Auth asli butuh Redis (mati di CI lokal).
const auth = vi.hoisted(() => ({ schoolId: "", userId: "", role: "ADMIN" as "ADMIN" | "GURU" | "SISWA" }));
const okAuth = () => ({
  ok: true as const, school: { id: auth.schoolId, slug: "x", name: "x" },
  userId: auth.userId, role: auth.role, sid: undefined, csrf: "", mustChangePassword: false,
});
vi.mock("@/server/api-gate", () => ({ apiGate: async () => okAuth() }));
// route leave pakai requireRole langsung (bukan apiGate) — mock juga.
vi.mock("@/server/auth-gate", () => ({ requireRole: async () => okAuth() }));

import { POST as manualPOST } from "../../app/api/attendance/manual/route";
import { POST as reviewPOST } from "../../app/api/leave/[id]/route";

let S = "";
let guru = "", siswa = "", classA = "";
const D1 = "2026-05-04", D2 = "2026-05-05", D3 = "2026-05-06";
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

function callReview(id: string, decision: "APPROVED" | "REJECTED"): Promise<Response> {
  const req = new NextRequest(new URL(`https://x.domainmu.id/api/leave/${id}`, "https://x.domainmu.id"), {
    method: "POST", headers: { host: "x.domainmu.id", "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  // @ts-expect-error hanya gate yang di-mock; params nyata
  return reviewPOST(req, { params: Promise.resolve({ id }) });
}

function callManual(date: string, status: "ALPHA" | "HADIR"): Promise<Response> {
  const req = new NextRequest(new URL("https://x.domainmu.id/api/attendance/manual", "https://x.domainmu.id"), {
    method: "POST", headers: { host: "x.domainmu.id", "content-type": "application/json" },
    body: JSON.stringify({ studentId: siswa, date, status }),
  });
  return manualPOST(req);
}

const att = (dateStr: string) => runAsSchool(db, S, (tx) =>
  tx.attendanceRecord.findUnique({ where: { schoolId_studentId_date: { schoolId: S, studentId: siswa, date: day(dateStr) } } }));

const mkLeave = (dateStr: string, status: "PENDING" | "APPROVED" | "REJECTED") =>
  runAsSchool(db, S, (tx) => tx.leaveRequest.create({
    data: { schoolId: S, studentId: siswa, date: day(dateStr), kind: "IZIN", description: "x", status },
  }));

beforeAll(async () => {
  const t = Date.now().toString(36);
  S = (await dbSystem.school.create({ data: { slug: `izx-${t}`, name: "IZ" } })).id;
  classA = (await dbSystem.class.create({ data: { schoolId: S, name: `A-${t}` } })).id;
  guru = (await dbSystem.user.create({ data: { schoolId: S, role: "GURU", name: "G", passwordHash: "x" } })).id;
  siswa = (await dbSystem.user.create({
    data: {
      schoolId: S, role: "SISWA", name: "S", passwordHash: "x",
      studentProfile: { create: { schoolId: S, classId: classA } },
    },
  })).id;
  auth.schoolId = S; auth.userId = guru; auth.role = "ADMIN";
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("izin disetujui ⇒ IZIN (bukan ALPHA)", () => {
  it("approve menimpa ALPHA cron menjadi IZIN", async () => {
    await runAsSchool(db, S, (tx) => tx.attendanceRecord.create({
      data: { schoolId: S, studentId: siswa, classId: classA, date: day(D1), status: "ALPHA", source: "AUTO" },
    }));
    const lv = await mkLeave(D1, "PENDING");
    const res = await callReview(lv.id, "APPROVED");
    expect(res.status).toBe(200);
    const a = await att(D1);
    expect(a?.status).toBe("IZIN");
    expect(a?.source).toBe("MANUAL");
  });

  it("re-review REJECTED menghapus IZIN buatan approval (tak jadi yatim)", async () => {
    const lv = await runAsSchool(db, S, (tx) =>
      tx.leaveRequest.findFirst({ where: { studentId: siswa, date: day(D1) } }));
    const res = await callReview(lv!.id, "REJECTED");
    expect(res.status).toBe(200);
    expect(await att(D1)).toBeNull();
  });

  it("REJECTED tidak menghapus IZIN yang di-set guru manual (editedById)", async () => {
    await runAsSchool(db, S, (tx) => tx.attendanceRecord.create({
      data: { schoolId: S, studentId: siswa, classId: classA, date: day(D3), status: "IZIN", source: "MANUAL", editedById: guru },
    }));
    const lv = await mkLeave(D3, "APPROVED");
    await callReview(lv.id, "REJECTED");
    const a = await att(D3);
    expect(a?.status).toBe("IZIN");
    expect(a?.editedById).toBe(guru);
  });
});

describe("override manual tidak boleh membuat ALPHA palsu", () => {
  it("manual ALPHA ditolak (409) bila ada izin APPROVED", async () => {
    await mkLeave(D2, "APPROVED");
    const res = await callManual(D2, "ALPHA");
    expect(res.status).toBe(409);
    expect(await att(D2)).toBeNull();
  });

  it("manual ALPHA diizinkan bila izin sudah REJECTED", async () => {
    const res = await callManual(D1, "ALPHA");
    expect(res.status).toBe(200);
    expect((await att(D1))?.status).toBe("ALPHA");
  });
});
