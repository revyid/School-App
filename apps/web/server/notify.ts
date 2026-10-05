// Helper notifikasi in-app: kanal utama. Push web sekunder (fire-and-forget).
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { sendPushToUser } from "./push";

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
  return users.length;
}
