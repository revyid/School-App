import { Queue, Worker, type Processor } from "bullmq";
import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

export function queueConnection(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export function workerConnection(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export const IMPORT_QUEUE = "import";

let _importQueue: Queue | null = null;

export function getImportQueue(): Queue {
  if (!_importQueue) {
    _importQueue = new Queue(IMPORT_QUEUE, { connection: queueConnection() });
  }
  return _importQueue;
}

export async function enqueueImport(schoolId: string, batchId: string): Promise<string> {
  const job = await getImportQueue().add(
    "process-import",
    { schoolId, batchId },
    { jobId: `import-${batchId}`, removeOnComplete: 100, removeOnFail: 500 },
  );
  return String(job.id);
}

export function startImportWorker(processor: Processor): Worker {
  return new Worker(IMPORT_QUEUE, processor, {
    connection: workerConnection(),
    concurrency: 1,
  });
}
