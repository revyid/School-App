// Realtime absensi: web publish event scan ke Redis pub/sub,
// worker (Socket.io, room per sekolah) broadcast ke browser guru.
import { Server as SocketServer } from "socket.io";
import { Redis } from "ioredis";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { authorizeSocket } from "./socket-auth.js";
import { SESSION_COOKIE } from "@sms/shared/auth";

const apex = () => process.env.APEX_DOMAIN ?? "domainmu.id";
const sub = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});
const pubRedis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

export interface ScanEvent {
  schoolId: string;
  studentId: string;
  name: string;
  className: string | null;
  scannedAt: string;
}

export async function publishScan(ev: ScanEvent): Promise<void> {
  await pubRedis.connect().catch(() => {});
  await pubRedis.publish("att:scan", JSON.stringify(ev));
}

export function attachRealtime(io: SocketServer): void {
  io.use(async (socket, next) => {
    try {
      const host = (socket.handshake.headers.host ?? "").split(",")[0].trim();
      const ctx = await authorizeSocket({
        cookieHeader: (socket.handshake.headers.cookie as string | undefined) ?? null,
        host,
        origin: (socket.handshake.headers.origin as string | undefined) ?? null,
        apex: apex(),
        sessionCookie: SESSION_COOKIE,
        resolveSchoolId: (slug) => db.school.findFirst({ where: { slug } }).then((s) => s?.id ?? null),
        lookupUser: (schoolId, uid) =>
          runAsSchool(db, schoolId, (tx) =>
            tx.user.findUnique({
              where: { id: uid },
              select: { isActive: true, role: true, passwordChangedAt: true },
            })),
      });
      socket.data.ctx = ctx;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const ctx = socket.data.ctx as { schoolId: string };
    socket.join(`school:${ctx.schoolId}`);
  });

  sub.connect().catch(() => {});
  sub.subscribe("att:scan").catch(() => {});
  sub.on("message", (_ch, raw) => {
    try {
      const ev = JSON.parse(raw) as ScanEvent;
      if (!ev.schoolId) return;
      io.to(`school:${ev.schoolId}`).emit("att:scan", ev);
    } catch {
      // abaikan payload rusak
    }
  });
}
