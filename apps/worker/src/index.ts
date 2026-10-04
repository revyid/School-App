import express from "express";
import { createServer } from "node:http";

const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});
// Socket.io + BullMQ + WA di-wire Phase 3/5.

const port = Number(process.env.PORT ?? 3001);
const server = createServer(app);
server.listen(port, "127.0.0.1", () => {
  console.log(`worker listening on 127.0.0.1:${port}`);
});
