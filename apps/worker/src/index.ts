import express from "express";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { startImportWorker } from "./queues.js";
import { processImportBatch } from "./import-processor.js";
import { attachRealtime } from "./realtime.js";
import { runAutoAlphaTick } from "./auto-alpha.js";

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

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);
const io = new SocketServer(server, {
  path: "/socket.io/",
  cors: { origin: false },
});
attachRealtime(io);

// Auto-Alpha tick tiap 5 menit (cutoffTime per sekolah dicek di dalam).
setInterval(() => {
  runAutoAlphaTick().catch((e: unknown) => console.error("auto-alpha tick gagal:", (e as Error).message));
}, 5 * 60 * 1000);

server.listen(port, "127.0.0.1", () => {
  console.log(`worker listening on 127.0.0.1:${port}`);
});
