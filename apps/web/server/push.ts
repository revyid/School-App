// Server utility: kirim push notification ke semua subscription user.
// Dipanggil dari notifyUser() — bukan route publik.
import webpush from "web-push";
import { db } from "@sms/db/client";
import { createHash } from "node:crypto";

// Prisma 7 generated client pakai @ts-nocheck sehingga model baru tidak
// muncul di tipe PrismaClient. Cast via any agar tsc happy tanpa mengubah
// runtime behavior (model sudah ada di DB + client.ts aktual).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbAny = db as any;

let configured = false;
function ensureVapid() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC;
  const priv = process.env.VAPID_PRIVATE;
  const mail = process.env.VAPID_MAILTO ?? "admin@example.com";
  if (!pub || !priv) return;
  webpush.setVapidDetails(`mailto:${mail}`, pub, priv);
  configured = true;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url = "/"
) {
  ensureVapid();
  if (!configured) return; // VAPID belum diset, skip

  const subs = await dbAny.pushSubscription.findMany({ where: { userId } });
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url }),
          { urgency: "normal", TTL: 86400 }
        );
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) dead.push(s.id);
      }
    })
  );

  if (dead.length) {
    await dbAny.pushSubscription.deleteMany({ where: { id: { in: dead } } });
  }
}

export function endpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}
