import express from "express";
import { createServer } from "node:http";
import { startImportWorker } from "./queues.js";
import { processImportBatch } from "./import-processor.js";

const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

const uploadsRoot = process.env.UPLOADS_ROOT ?? "/data/uploads";

startImportWorker(async (job) => {
  const { schoolId, batchId } = job.data as { schoolId: string; batchId: string };
  if (!schoolId || !batchId) throw new Error("job data tidak valid");
  const filePath = `${uploadsRoot}/${schoolId}/imports/${batchId}.xlsx`;
  await processImportBatch(schoolId, batchId, filePath);
  await job.updateProgress(100);
});

// Socket.io di-wire Phase 3.

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);
server.listen(port, "127.0.0.1", () => {
  console.log(`worker listening on 127.0.0.1:${port}`);
});
