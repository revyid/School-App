// Outbox WA milik web: tulis baris + enqueue BullMQ ( TANPA mengimpor kode worker).
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

let _q: Queue | null = null;
function q(): Queue {
  if (!_q) {
    _q = new Queue("wa", {
      connection: new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      }),
    });
  }
  return _q;
}

export async function enqueueOutbox(
  schoolId: string,
  to: string,
  text: string,
  dedupeKey?: string,
): Promise<{ id: string; duplicate: boolean }> {
  if (dedupeKey) {
    const prev = await runAsSchool(db, schoolId, (tx) =>
      tx.messageOutbox.findUnique({ where: { schoolId_dedupeKey: { schoolId, dedupeKey } } }),
    );
    if (prev) return { id: prev.id, duplicate: true };
    try {
      const row = await runAsSchool(db, schoolId, (tx) =>
        tx.messageOutbox.create({
          data: { schoolId, to, text, dedupeKey, status: "QUEUED" },
        }),
      );
      await q().add("send", { schoolId, outboxId: row.id }, {
        jobId: `wa-${row.id}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      });
      return { id: row.id, duplicate: false };
    } catch {
      // Balapan dedupeKey: baca ulang.
      const again = await runAsSchool(db, schoolId, (tx) =>
        tx.messageOutbox.findUnique({ where: { schoolId_dedupeKey: { schoolId, dedupeKey } } }),
      );
      if (again) return { id: again.id, duplicate: true };
      throw new Error("gagal antre WA");
    }
  }
  const row = await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.create({ data: { schoolId, to, text, status: "QUEUED" } }),
  );
  await q().add("send", { schoolId, outboxId: row.id }, {
    jobId: `wa-${row.id}`,
    attempts: 5,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  });
  return { id: row.id, duplicate: false };
}
