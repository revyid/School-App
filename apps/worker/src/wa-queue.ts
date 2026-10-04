// Antrean WA BullMQ "wa": job per pesan, idempotent via jobId = outboxId.
// Jeda acak 3-10 dtk antar pesan + cap per menit & per hari dari SchoolSettings.
// Retry + backoff; tanpa fallback kanal lain.
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import type { MessageProvider } from "@sms/shared/notify";
import { BaileysProvider } from "./baileys-provider.js";
import { FakeProvider } from "./fake-provider.js";

function conn() {
  return new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const WA_QUEUE = "wa";
let _queue: Queue | null = null;

export function waQueue(): Queue {
  if (!_queue) _queue = new Queue(WA_QUEUE, { connection: conn() });
  return _queue;
}

export async function enqueueWa(schoolId: string, outboxId: string): Promise<void> {
  await waQueue().add(
    "send",
    { schoolId, outboxId },
    {
      jobId: `wa-${outboxId}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

function providerFor(schoolId: string): MessageProvider {
  if (process.env.WA_FAKE === "1") {
    const g = globalThis as unknown as { __fakeWa?: Map<string, FakeProvider> };
    if (!g.__fakeWa) g.__fakeWa = new Map();
    let p = g.__fakeWa.get(schoolId);
    if (!p) {
      p = new FakeProvider();
      g.__fakeWa.set(schoolId, p);
    }
    return p;
  }
  return new BaileysProvider(schoolId);
}

// Jeda acak 3-10 dtk sebelum kirim (antar pesan).
export function waJitterMs(): number {
  return 3000 + Math.floor(Math.random() * 7000);
}

async function checkCaps(schoolId: string): Promise<{ ok: boolean; reason?: string }> {
  const settings = await runAsSchool(db, schoolId, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId } }),
  );
  const perMin = settings?.waPerMinuteCap ?? 10;
  const perDay = settings?.waDailyCap ?? 300;
  const now = new Date();
  const minAgo = new Date(now.getTime() - 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const sentMin = await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.count({ where: { status: "SENT", sentAt: { gte: minAgo } } }));
  if (sentMin >= perMin) return { ok: false, reason: "cap per menit tercapai" };
  const sentDay = await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.count({ where: { status: "SENT", sentAt: { gte: dayAgo } } }));
  if (sentDay >= perDay) return { ok: false, reason: "kuota harian tercapai" };
  return { ok: true };
}

export async function processWaJob(job: Job<{ schoolId: string; outboxId: string }>): Promise<void> {
  const { schoolId, outboxId } = job.data;
  const row = await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.findUnique({ where: { id: outboxId } }),
  );
  if (!row) return; // idempotent: baris hilang -> anggap selesai
  if (row.status === "SENT") return; // idempotent: sudah terkirim
  if (row.scheduledAt.getTime() > Date.now()) {
    throw new Error("belum waktunya (delay)");
  }
  const caps = await checkCaps(schoolId);
  if (!caps.ok) throw new Error(caps.reason!); // retry via backoff

  await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.update({ where: { id: outboxId }, data: { status: "SENDING", attempts: { increment: 1 } } }),
  );
  // Jeda acak antar pesan.
  await new Promise((r) => setTimeout(r, process.env.WA_FAKE === "1" ? 0 : waJitterMs()));
  const res = await providerFor(schoolId).send(row.to, row.text);
  if (!res.ok) {
    await runAsSchool(db, schoolId, (tx) =>
      tx.messageOutbox.update({ where: { id: outboxId }, data: { status: "QUEUED", lastError: res.error?.slice(0, 500) } }),
    );
    throw new Error(res.error ?? "gagal kirim");
  }
  await runAsSchool(db, schoolId, (tx) =>
    tx.messageOutbox.update({
      where: { id: outboxId },
      data: { status: "SENT", sentAt: new Date(), lastError: null },
    }),
  );
}

export function startWaWorker(): Worker {
  const w = new Worker(WA_QUEUE, processWaJob, { connection: conn(), concurrency: 1 });
  return w;
}
