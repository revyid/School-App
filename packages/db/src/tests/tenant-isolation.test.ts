import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../client.js";
import { runAsSchool } from "../tenant.js";
import { dbSystemTest } from "../test-utils.js"; // TEST-ONLY

const RLS_TABLES = ["User", "Class", "TeacherClass", "StudentProfile", "AuditLog", "School", "Subject", "SchoolSettings", "TimetableSlot", "ImportBatch", "AttendanceRecord", "AcademicCalendar", "StudentQr", "Task", "TaskMaterial", "Submission", "Notification", "MessageOutbox", "LeaveRequest", "CaptureSession", "ParentalConsent", "PrivacyPolicy", "Assessment", "Question", "AssessQuestion", "AssessAttempt", "AssessAnswer", "StudyGroup", "StudyGroupMember", "ExpLog"];
// Aturan: setiap tabel tenant BARU wajib ditambah di RLS_TABLES + satu blok it di bawah.

let A = "", B = "";
const BIDS: Record<string, string> = {};
let seq = 0;
const uniq = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

type Tx = Parameters<Parameters<typeof runAsSchool>[2]>[0];

beforeAll(async () => {
  // GUARD: tes ini HARUS jalan sebagai app_user (bukan superuser/bypassrls).
  // Kalau koneksi punya hak lewat RLS, semua assertion di bawah tak berarti.
  const rows = await db.$queryRaw<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }[]>`
    SELECT current_user, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
  const me = rows[0];
  if (!me || me.current_user !== "app_user" || me.rolsuper || me.rolbypassrls) {
    throw new Error(
      `tenant-isolation.test.ts WAJIB jalan sebagai app_user tanpa BYPASSRLS; ` +
      `dapat current_user=${me?.current_user} rolsuper=${me?.rolsuper} rolbypassrls=${me?.rolbypassrls}. ` +
      `Set DATABASE_URL ke role app_user.`,
    );
  }
  const t = Date.now().toString(36);
  A = (await dbSystemTest.school.create({ data: { slug: `ia-${t}`, name: "A" } })).id;
  B = (await dbSystemTest.school.create({ data: { slug: `ib-${t}`, name: "B" } })).id;
  BIDS.guru = (await dbSystemTest.user.create({ data: { schoolId: B, role: "GURU", email: `${uniq("g")}@t.id`, name: "GB", passwordHash: "x" } })).id;
  BIDS.class = (await dbSystemTest.class.create({ data: { schoolId: B, name: uniq("K") } })).id;
  BIDS.user = (await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("9"), name: "SB", passwordHash: "x" } })).id;
  BIDS.profile = (await dbSystemTest.studentProfile.create({ data: { schoolId: B, userId: BIDS.user, classId: BIDS.class } })).id;
  BIDS.ta = (await dbSystemTest.teacherClass.create({ data: { schoolId: B, teacherId: BIDS.guru, classId: BIDS.class, subject: "MTK" } })).id;
  BIDS.log = (await dbSystemTest.auditLog.create({ data: { schoolId: B, action: "TEST.SEED" } })).id;
  BIDS.subject = (await dbSystemTest.subject.create({ data: { schoolId: B, name: uniq("S") } })).id;
  BIDS.settings = (await dbSystemTest.schoolSettings.create({ data: { schoolId: B, portalName: "PB" } })).id;
  BIDS.slot = (await dbSystemTest.timetableSlot.create({ data: { schoolId: B, classId: BIDS.class, dayOfWeek: 1, startTime: "07:00", endTime: "07:45", subjectName: "MTK" } })).id;
  BIDS.batch = (await dbSystemTest.importBatch.create({ data: { schoolId: B, createdById: BIDS.guru, fileName: "t.xlsx" } })).id;
  const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("6"), name: "SB2", passwordHash: "x" } });
  BIDS.att = (await dbSystemTest.attendanceRecord.create({ data: { schoolId: B, studentId: bu.id, date: new Date(Date.UTC(2026, 0, 5)), status: "HADIR", source: "SCAN" } })).id;
  BIDS.cal = (await dbSystemTest.academicCalendar.create({ data: { schoolId: B, date: new Date(Date.UTC(2026, 0, 6)), kind: "LIBUR" } })).id;
  BIDS.qr = (await dbSystemTest.studentQr.create({ data: { schoolId: B, studentId: bu.id, token: `sms1-${uniq("a").replace(/[^0-9a-f]/g, "b").padEnd(32, "0").slice(0, 32)}` } })).id;
});
afterAll(async () => {
  await dbSystemTest.school.deleteMany({ where: { id: { in: [A, B] } } });
});

describe("tenant isolation", () => {
  it("SEMUA tabel public (kecuali _prisma_migrations) punya RLS + FORCE", async () => {
    const rows = await dbSystemTest.$queryRaw<{ relname: string; ok: boolean }[]>`
      SELECT c.relname, (c.relrowsecurity AND c.relforcerowsecurity) AS ok
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname <> '_prisma_migrations' AND c.relname NOT LIKE 'pg_%'`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.ok)).toEqual([]);
    expect(rows.map((r) => r.relname).sort()).toEqual(expect.arrayContaining([...RLS_TABLES].sort()));
  });

  it("User: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.user.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.user);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.findUniqueOrThrow({ where: { id: BIDS.user } }))).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.updateMany({ where: { id: BIDS.user }, data: { name: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.user.deleteMany({ where: { id: BIDS.user } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("8"), name: "j", passwordHash: "x" } })
    )).rejects.toThrow();
  });

  it("Class: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.class.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.class);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.class.updateMany({ where: { id: BIDS.class }, data: { name: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.class.deleteMany({ where: { id: BIDS.class } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.class.create({ data: { schoolId: B, name: uniq("J") } })
    )).rejects.toThrow();
  });

  it("TeacherClass: INSERT lintas sekolah pakai baris baru (gagal karena RLS)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.teacherClass.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.ta);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.teacherClass.updateMany({ where: { id: BIDS.ta }, data: { subject: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.teacherClass.deleteMany({ where: { id: BIDS.ta } }))).resolves.toMatchObject({ count: 0 });
    const g = await dbSystemTest.user.create({ data: { schoolId: B, role: "GURU", email: `${uniq("h")}@t.id`, name: "H", passwordHash: "x" } });
    const c = await dbSystemTest.class.create({ data: { schoolId: B, name: uniq("K") } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.teacherClass.create({ data: { schoolId: B, teacherId: g.id, classId: c.id, subject: "j" } })
    )).rejects.toThrow();
  });

  it("StudentProfile: INSERT lintas sekolah pakai user baru (gagal karena RLS)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.studentProfile.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.profile);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.studentProfile.updateMany({ where: { id: BIDS.profile }, data: { bio: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.studentProfile.deleteMany({ where: { id: BIDS.profile } }))).resolves.toMatchObject({ count: 0 });
    const u = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", nisn: uniq("7"), name: "F", passwordHash: "x" } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.studentProfile.create({ data: { schoolId: B, userId: u.id } })
    )).rejects.toThrow();
  });

  it("AuditLog: UPDATE/DELETE melempar (tanpa grant)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.auditLog.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.log);
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.updateMany({ where: { id: BIDS.log }, data: { action: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.deleteMany({ where: { id: BIDS.log } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.auditLog.create({ data: { schoolId: B, action: "j" } })
    )).rejects.toThrow();
  });

  it("tanpa scope, app_user buta total (bukan error)", async () => {
    await expect(db.user.findMany()).resolves.toEqual([]);
  });

  it("School: scope A BOLEH membaca direktori semua sekolah", async () => {
    const schools = await runAsSchool(db, A, (tx: Tx) => tx.school.findMany({ select: { id: true } }));
    expect(schools.map((s) => s.id)).toEqual(expect.arrayContaining([A, B]));
  });

  it("School: INSERT/UPDATE/DELETE oleh app_user melempar", async () => {
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.create({ data: { slug: uniq("j"), name: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.updateMany({ where: { id: B }, data: { name: "j" } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.school.deleteMany({ where: { id: B } })
    )).rejects.toThrow();
  });

  it("Subject: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.subject.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.subject);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.subject.updateMany({ where: { id: BIDS.subject }, data: { name: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.subject.deleteMany({ where: { id: BIDS.subject } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.subject.create({ data: { schoolId: B, name: uniq("J") } })
    )).rejects.toThrow();
  });

  it("SchoolSettings: scope A buta terhadap B (tenant, bukan publik)", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.schoolSettings.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.settings);
    // Grant app_user = SELECT, INSERT, UPDATE (tanpa DELETE): UPDATE lintas sekolah
    // tak terlihat RLS -> count 0; DELETE tanpa grant -> permission-denied.
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.schoolSettings.updateMany({ where: { id: BIDS.settings }, data: { portalName: "j" } })
    )).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.schoolSettings.deleteMany({ where: { id: BIDS.settings } })
    )).rejects.toThrow();
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.schoolSettings.create({ data: { schoolId: B, portalName: "j" } })
    )).rejects.toThrow();
  });

  it("TimetableSlot: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.timetableSlot.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.slot);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.timetableSlot.updateMany({ where: { id: BIDS.slot }, data: { subjectName: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.timetableSlot.deleteMany({ where: { id: BIDS.slot } }))).resolves.toMatchObject({ count: 0 });
    const c = await dbSystemTest.class.create({ data: { schoolId: B, name: uniq("K") } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.timetableSlot.create({ data: { schoolId: B, classId: c.id, dayOfWeek: 2, startTime: "07:00", endTime: "07:45" } })
    )).rejects.toThrow();
  });

  it("ImportBatch: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.importBatch.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.batch);
    await expect(runAsSchool(db, A, (tx: Tx) => tx.importBatch.updateMany({ where: { id: BIDS.batch }, data: { fileName: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) => tx.importBatch.deleteMany({ where: { id: BIDS.batch } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.importBatch.create({ data: { schoolId: B, createdById: BIDS.guru, fileName: "j.xlsx" } })
    )).rejects.toThrow();
  });

  it("AttendanceRecord: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.attendanceRecord.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.att);
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.attendanceRecord.updateMany({ where: { id: BIDS.att }, data: { note: "j" } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.attendanceRecord.deleteMany({ where: { id: BIDS.att } }))).resolves.toMatchObject({ count: 0 });
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB3", passwordHash: "x" } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.attendanceRecord.create({ data: { schoolId: B, studentId: bu.id, date: new Date(Date.UTC(2026, 0, 7)), status: "HADIR", source: "SCAN" } })
    )).rejects.toThrow();
  });

  it("AcademicCalendar: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.academicCalendar.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.cal);
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.academicCalendar.deleteMany({ where: { id: BIDS.cal } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.academicCalendar.create({ data: { schoolId: B, date: new Date(Date.UTC(2026, 0, 8)), kind: "LIBUR" } })
    )).rejects.toThrow();
  });

  it("StudentQr: scope A buta terhadap B", async () => {
    const rows = await runAsSchool(db, A, (tx: Tx) => tx.studentQr.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(BIDS.qr);
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.studentQr.deleteMany({ where: { id: BIDS.qr } }))).resolves.toMatchObject({ count: 0 });
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB4", passwordHash: "x" } });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.studentQr.create({ data: { schoolId: B, studentId: bu.id, token: `sms1-${"c".repeat(32)}` } })
    )).rejects.toThrow();
  });

  it("Task/TaskMaterial/Submission: scope A buta terhadap B", async () => {
    const bt = await dbSystemTest.task.create({
      data: { schoolId: B, classId: BIDS.class, authorId: BIDS.guru, title: "BT", instruction: "i", publishAt: new Date("2026-01-01T00:00:00Z") },
    });
    const bm = await dbSystemTest.taskMaterial.create({
      data: { schoolId: B, taskId: bt.id, kind: "TEXT", text: "materi" },
    });
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB5", passwordHash: "x" } });
    const bs = await dbSystemTest.submission.create({
      data: { schoolId: B, taskId: bt.id, studentId: bu.id, text: "j" },
    });
    for (const [model, id] of [["task", bt.id], ["taskMaterial", bm.id], ["submission", bs.id]] as const) {
      const rows = await runAsSchool(db, A, (tx: Tx) => (tx[model] as { findMany: (a: object) => Promise<{ id: string }[]> }).findMany({ select: { id: true } }));
      expect(rows.map((r) => r.id)).not.toContain(id);
    }
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.task.deleteMany({ where: { id: bt.id } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.submission.create({ data: { schoolId: B, taskId: bt.id, studentId: bu.id, text: "x" } })
    )).rejects.toThrow();
  });

  it("Notification/MessageOutbox: scope A buta terhadap B", async () => {
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB6", passwordHash: "x" } });
    const bn = await dbSystemTest.notification.create({
      data: { schoolId: B, userId: bu.id, title: "T", body: "B" },
    });
    const bo = await dbSystemTest.messageOutbox.create({
      data: { schoolId: B, to: "6281", text: "halo", dedupeKey: `iso-${Date.now()}` },
    });
    for (const [model, id] of [["notification", bn.id], ["messageOutbox", bo.id]] as const) {
      const rows = await runAsSchool(db, A, (tx: Tx) => (tx[model] as { findMany: (a: object) => Promise<{ id: string }[]> }).findMany({ select: { id: true } }));
      expect(rows.map((r) => r.id)).not.toContain(id);
    }
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.notification.deleteMany({ where: { id: bn.id } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.messageOutbox.create({ data: { schoolId: B, to: "6281", text: "x" } })
    )).rejects.toThrow();
  });

  it("LeaveRequest/CaptureSession/ParentalConsent/PrivacyPolicy: scope A buta terhadap B", async () => {
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB7", passwordHash: "x" } });
    const bl = await dbSystemTest.leaveRequest.create({
      data: { schoolId: B, studentId: bu.id, date: new Date(Date.UTC(2026, 5, 1)), kind: "IZIN", description: "sakit perut parah" },
    });
    const bc = await dbSystemTest.captureSession.create({
      data: { schoolId: B, studentId: bu.id, token: `cap-${Date.now().toString(36)}`, expiresAt: new Date(Date.now() + 300_000) },
    });
    const bp = await dbSystemTest.parentalConsent.create({
      data: { schoolId: B, studentId: bu.id, consented: true },
    });
    const bv = await dbSystemTest.privacyPolicy.create({
      data: { schoolId: B, text: "kebijakan B" },
    });
    for (const [model, id] of [["leaveRequest", bl.id], ["captureSession", bc.id], ["parentalConsent", bp.id], ["privacyPolicy", bv.id]] as const) {
      const rows = await runAsSchool(db, A, (tx: Tx) => (tx[model] as { findMany: (a: object) => Promise<{ id: string }[]> }).findMany({ select: { id: true } }));
      expect(rows.map((r) => r.id)).not.toContain(id);
    }
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.leaveRequest.deleteMany({ where: { id: bl.id } }))).resolves.toMatchObject({ count: 0 });
    await expect(runAsSchool(db, A, (tx: Tx) =>
      tx.leaveRequest.create({ data: { schoolId: B, studentId: bu.id, date: new Date(Date.UTC(2026, 5, 2)), kind: "SAKIT", description: "demam tinggi" } })
    )).rejects.toThrow();
  });

  it("Assessment/Question/Attempt/Group/ExpLog: scope A buta terhadap B; unique grup ditegakkan", async () => {
    const bu = await dbSystemTest.user.create({ data: { schoolId: B, role: "SISWA", name: "SB8", passwordHash: "x" } });
    const bc = await dbSystemTest.class.create({ data: { schoolId: B, name: `KB-${Date.now().toString(36)}` } });
    const ba = await dbSystemTest.assessment.create({
      data: { schoolId: B, classId: bc.id, authorId: bu.id, title: "UH-1" },
    });
    const bq = await dbSystemTest.question.create({
      data: { schoolId: B, authorId: bu.id, type: "MCQ", stem: "1+1?", options: ["1", "2"], correctIndex: 1 },
    });
    const bt = await dbSystemTest.assessAttempt.create({
      data: { schoolId: B, assessmentId: ba.id, studentId: bu.id },
    });
    const bg = await dbSystemTest.studyGroup.create({
      data: { schoolId: B, assessmentId: ba.id, name: "G1" },
    });
    await dbSystemTest.studyGroupMember.create({
      data: { schoolId: B, groupId: bg.id, studentId: bu.id, assessmentId: ba.id },
    });
    const be = await dbSystemTest.expLog.create({
      data: { schoolId: B, studentId: bu.id, points: 10, reason: "t", dedupeKey: `k-${Date.now().toString(36)}` },
    });
    for (const [model, id] of [["assessment", ba.id], ["question", bq.id], ["assessAttempt", bt.id], ["studyGroup", bg.id], ["expLog", be.id]] as const) {
      const rows = await runAsSchool(db, A, (tx: Tx) => (tx[model] as { findMany: (a: object) => Promise<{ id: string }[]> }).findMany({ select: { id: true } }));
      expect(rows.map((r) => r.id)).not.toContain(id);
    }
    // Satu siswa = satu grup per asesmen: duplikat ditolak DB.
    await expect(dbSystemTest.studyGroupMember.create({
      data: { schoolId: B, groupId: bg.id, studentId: bu.id, assessmentId: ba.id },
    })).rejects.toThrow();
    // Kunci jawaban tak ikut di select aman (kolom ada tapi route tak pernah select).
    const q = await runAsSchool(db, B, (tx: Tx) =>
      (tx.question as { findFirst: (a: object) => Promise<{ correctIndex: number } | null> }).findFirst({ where: { id: bq.id }, select: { correctIndex: true } }));
    expect(q?.correctIndex).toBe(1);
  });
});
