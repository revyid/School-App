// Helper enqueue BullMQ dari web. Web TIDAK mengimpor @sms/worker;
// antrean diakses langsung via Redis yang sama. Nama antrean + jobId
// harus sinkron dengan apps/worker/src/queues.ts.
import { Queue } from "bullmq";
import { Redis } from "ioredis";

let _q: Queue | null = null;

export function getImportQueue(): Queue {
  if (!_q) {
    const conn = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _q = new Queue("import", { connection: conn });
  }
  return _q;
}

export async function enqueueImport(schoolId: string, batchId: string): Promise<string> {
  const job = await getImportQueue().add(
    "process-import",
    { schoolId, batchId },
    { jobId: `import-${batchId}`, removeOnComplete: 100, removeOnFail: 500 },
  );
  return String(job.id);
}
