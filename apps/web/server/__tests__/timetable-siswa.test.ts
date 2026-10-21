import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server.js";
import argon2 from "argon2";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { db } from "@lacakedu/db/client";
import { dbSystemTest as dbSystem } from "@lacakedu/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@lacakedu/db/tenant";
import { createSession } from "../session.js";
import { redis } from "../redis.js";
import { GET } from "../../app/api/timetable/route.js";

const PW = "pw-12345678";
let S = "";
let slug = "";
let seq = 0;
let classA = "", classB = "";
let siswaSid = "", guruSid = "", adminSid = "";

async function mkuser(role: "ADMIN" | "GURU" | "SISWA", classId?: string) {
  seq++;
  const t = `${Date.now().toString(36)}${seq}${Math.random().toString(36).slice(2, 4)}`;
  const u = await dbSystem.user.create({
    data: {
      schoolId: S, role, email: `tt-${role}-${t}@t.id`, nisn: `6${t}`.replace(/\D/g, "").slice(0, 12),
      name: `${role} ${t}`, passwordHash: await argon2.hash(PW, { type: argon2.argon2id }),
      ...(classId && role === "SISWA" ? { studentProfile: { create: { schoolId: S, classId } } } : {}),
    },
  });
  const s = await createSession(u.id, S, slug, role);
  return { u, sid: s.sid };
}

function req(path: string, sid?: string) {
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const headers: Record<string, string> = { host: `${slug}.${apex}` };
  if (sid) headers.cookie = `${SESSION_COOKIE}=${sid}`;
  return new NextRequest(`http://${slug}.${apex}${path}`, { headers });
}

beforeAll(async () => {
  await redis.connect().catch(() => {});
  const t = Date.now().toString(36);
  slug = `ttx-${t}`;
  S = (await dbSystem.school.create({ data: { slug, name: "TT" } })).id;
  classA = (await dbSystem.class.create({ data: { schoolId: S, name: `TA-${t}` } })).id;
  classB = (await dbSystem.class.create({ data: { schoolId: S, name: `TB-${t}` } })).id;
  siswaSid = (await mkuser("SISWA", classA)).sid;
  guruSid = (await mkuser("GURU")).sid;
  adminSid = (await mkuser("ADMIN")).sid;
  await dbSystem.timetableSlot.create({
    data: { schoolId: S, classId: classA, subjectName: "Matematika", dayOfWeek: 1, startTime: "07:00", endTime: "08:30" },
  });
  await dbSystem.timetableSlot.create({
    data: { schoolId: S, classId: classB, subjectName: "Fisika", dayOfWeek: 2, startTime: "07:00", endTime: "08:30" },
  });
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
  await redis.quit();
});

describe("GET /api/timetable untuk SISWA (kelas sendiri saja)", () => {
  it("siswa baca kelas sendiri → 200 + hanya slot kelasnya", async () => {
    const res = await GET(req(`/api/timetable?classId=${classA}`, siswaSid));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.rows.length).toBe(1);
    expect(d.rows[0].subjectName).toBe("Matematika");
  });

  it("siswa tanpa classId → 200 default kelas sendiri", async () => {
    const res = await GET(req(`/api/timetable`, siswaSid));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.rows.length).toBe(1);
    expect(d.rows[0].classId ?? d.rows[0].class?.id).toBeTruthy();
  });

  it("siswa baca kelas lain → 403", async () => {
    const res = await GET(req(`/api/timetable?classId=${classB}`, siswaSid));
    expect(res.status).toBe(403);
  });

  it("tanpa sesi → 401", async () => {
    const res = await GET(req(`/api/timetable?classId=${classA}`));
    expect(res.status).toBe(401);
  });

  it("guru/admin tetap bisa baca dengan classId (regresi)", async () => {
    const g = await GET(req(`/api/timetable?classId=${classA}`, guruSid));
    expect(g.status).toBe(200);
    const a = await GET(req(`/api/timetable?classId=${classB}`, adminSid));
    expect(a.status).toBe(200);
    const g2 = await GET(req(`/api/timetable`, guruSid));
    expect(g2.status).toBe(400);
  });
});
