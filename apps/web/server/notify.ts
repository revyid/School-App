// Helper notifikasi in-app: kanal utama. Push web sekunder (fire-and-forget).
// N5: notifyUser menerima href tujuan + kind; kolom Notification sudah ada.
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { sendPushToUser } from "./push";
import { Redis } from "ioredis";

export interface NotifEvent {
  schoolId: string;
  userId?: string | null;
  title: string;
  body: string;
}

export interface NotifOpts {
  /** N5: tautan tujuan (mis. /siswa/tugas/<id>) — tombol "Buka" di popup. */
  href?: string;
  /** Jenis pemicu (mis. task-published, task-graded, announcement). */
  kind?: string;
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
  opts: NotifOpts | string = {},
): Promise<void> {
  // Back-compat: arg ke-5 lama berupa url string ("/") untuk push.
  const o: NotifOpts = typeof opts === "string" ? { href: "/" } : opts;
  await runAsSchool(db, schoolId, (tx) =>
    tx.notification.create({
      data: {
        schoolId, userId,
        title: title.slice(0, 200), body: body.slice(0, 2000),
        href: o.href?.slice(0, 300) ?? null,
        kind: o.kind?.slice(0, 64) ?? null,
      },
    }),
  );
  // Realtime WS: broadcast event notifikasi ke socket user
  void publishNotif({ schoolId, userId, title, body });
  // Push web: fire-and-forget, jangan gagalkan notif in-app.
  sendPushToUser(userId, title, body, o.href ?? "/").catch(() => {});
}

// Broadcast sekolah: hanya ADMIN yang boleh memanggil (dicek di route — N8).
export async function notifySchool(
  schoolId: string,
  title: string,
  body: string,
  opts: NotifOpts = {},
): Promise<number> {
  const users = await runAsSchool(db, schoolId, (tx) =>
    tx.user.findMany({ where: { isActive: true }, select: { id: true }, take: 5000 }));
  for (const u of users) {
    await runAsSchool(db, schoolId, (tx) =>
      tx.notification.create({
        data: {
          schoolId, userId: u.id,
          title: title.slice(0, 200), body: body.slice(0, 2000),
          href: opts.href?.slice(0, 300) ?? null,
          kind: opts.kind?.slice(0, 64) ?? null,
        },
      }));
    sendPushToUser(u.id, title, body, opts.href ?? "/").catch(() => {});
  }
  // Realtime WS broadcast ke seluruh sekolah
  void publishNotif({ schoolId, userId: null, title, body });
  return users.length;
}
