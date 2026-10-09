// Helper notifikasi in-app: kanal utama. Push web sekunder (fire-and-forget).
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { sendPushToUser } from "./push";
import { Redis } from "ioredis";

export interface NotifEvent {
  schoolId: string;
  userId?: string | null;
  title: string;
  body: string;
}

let _pub: Redis | null = null;
function getPub(): Redis {
  if (!_pub) {
    _pub = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _pub;
}

async function publishNotif(ev: NotifEvent): Promise<void> {
  try {
    await getPub().publish("att:notif", JSON.stringify(ev));
  } catch { /* abaikan error redis */ }
}

export async function notifyUser(
  schoolId: string,
  userId: string,
  title: string,
  body: string,
  url = "/"
): Promise<void> {
  await runAsSchool(db, schoolId, (tx) =>
    tx.notification.create({
      data: { schoolId, userId, title: title.slice(0, 200), body: body.slice(0, 2000) },
    }),
  );
  // Realtime WS: broadcast event notifikasi ke socket user
  void publishNotif({ schoolId, userId, title, body });
  // Push web: fire-and-forget, jangan gagalkan notif in-app.
  sendPushToUser(userId, title, body, url).catch(() => {});
}

// Broadcast sekolah: hanya ADMIN yang boleh memanggil (dicek di route).
export async function notifySchool(schoolId: string, title: string, body: string, url = "/"): Promise<number> {
  const users = await runAsSchool(db, schoolId, (tx) =>
    tx.user.findMany({ where: { isActive: true }, select: { id: true }, take: 5000 }));
  for (const u of users) {
    await runAsSchool(db, schoolId, (tx) =>
      tx.notification.create({
        data: { schoolId, userId: u.id, title: title.slice(0, 200), body: body.slice(0, 2000) },
      }),
    );
    sendPushToUser(u.id, title, body, url).catch(() => {});
  }
  // Realtime WS broadcast ke seluruh sekolah
  void publishNotif({ schoolId, userId: null, title, body });
  return users.length;
}
