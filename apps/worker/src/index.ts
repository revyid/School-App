import express from "express";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { startImportWorker } from "./queues.js";
import { processImportBatch } from "./import-processor.js";
import { attachRealtime } from "./realtime.js";
import { runAutoAlphaTick } from "./auto-alpha.js";

import { startWaWorker, waQueue } from "./wa-queue.js";
import { runDeadlineReminders } from "./reminders.js";
import { runLeaveRetention } from "./retention.js";
import { BaileysProvider } from "./baileys-provider.js";

const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// Internal (hanya loopback): status sesi WA + QR pairing per sekolah.
// Dipanggil web server-side (bukan browser) dengan header x-internal-token.
app.get("/wa-status", async (req, res) => {
  if (req.headers["x-internal-token"] !== (process.env.INTERNAL_TOKEN ?? "")) {
    res.status(403).send("forbidden");
    return;
  }
  const schoolId = String(req.query.schoolId ?? "");
  if (!schoolId) {
    res.status(400).send("schoolId?");
    return;
  }
  const p = new BaileysProvider(schoolId);
  const st = await p.status().catch(() => ({ connected: false as const, detail: "error" }));
  const qr = !st.connected ? await p.qr().catch(() => null) : null;
  res.json({ ...st, qr });
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

// Pengingat H-1 deadline tiap jam + worker WA.
setInterval(() => {
  runDeadlineReminders().catch((e: unknown) => console.error("reminder tick gagal:", (e as Error).message));
}, 60 * 60 * 1000);

// Retensi foto izin harian.
setInterval(() => {
  runLeaveRetention().catch((e: unknown) => console.error("retensi tick gagal:", (e as Error).message));
}, 24 * 60 * 60 * 1000);

startWaWorker();

server.listen(port, "127.0.0.1", () => {
  console.log(`worker listening on 127.0.0.1:${port}`);
});
