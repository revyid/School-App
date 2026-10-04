import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { dbSystemTest as dbSystem } from "@sms/db/test-utils"; // TEST-ONLY
import { runAsSchool } from "@sms/db/tenant";
import { db } from "@sms/db/client";

let S = "";

beforeAll(async () => {
  const t = Date.now().toString(36);
  S = (await dbSystem.school.create({ data: { slug: `wax-${t}`, name: "WA" } })).id;
});

afterAll(async () => {
  await dbSystem.school.deleteMany({ where: { id: S } });
});

describe("outbox dedupeKey", () => {
  it("dedupeKey sama -> unique violation (idempoten di level DB)", async () => {
    await runAsSchool(db, S, (tx) =>
      tx.messageOutbox.create({ data: { schoolId: S, to: "6281", text: "a", dedupeKey: "k-1" } }));
    await expect(runAsSchool(db, S, (tx) =>
      tx.messageOutbox.create({ data: { schoolId: S, to: "6281", text: "a", dedupeKey: "k-1" } })
    )).rejects.toThrow();
    // Tanpa dedupeKey boleh ganda.
    await runAsSchool(db, S, (tx) =>
      tx.messageOutbox.create({ data: { schoolId: S, to: "6281", text: "b" } }));
    const n = await runAsSchool(db, S, (tx) => tx.messageOutbox.count({}));
    expect(n).toBe(2);
  });

  it("notifikasi per user: user lain tak terlihat", async () => {
    const u1 = await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "W1", passwordHash: "x" } });
    const u2 = await dbSystem.user.create({ data: { schoolId: S, role: "SISWA", name: "W2", passwordHash: "x" } });
    await runAsSchool(db, S, (tx) =>
      tx.notification.create({ data: { schoolId: S, userId: u1.id, title: "T", body: "B" } }));
    const mine = await runAsSchool(db, S, (tx) =>
      tx.notification.findMany({ where: { userId: u2.id } }));
    expect(mine).toHaveLength(0);
    const own = await runAsSchool(db, S, (tx) =>
      tx.notification.findMany({ where: { userId: u1.id } }));
    expect(own).toHaveLength(1);
  });
});
