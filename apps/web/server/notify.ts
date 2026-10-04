// Helper notifikasi in-app: kanal utama. WA sekunder via outbox (worker).
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

export async function notifyUser(
  schoolId: string,
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await runAsSchool(db, schoolId, (tx) =>
    tx.notification.create({
      data: { schoolId, userId, title: title.slice(0, 200), body: body.slice(0, 2000) },
    }),
  );
}

// Broadcast sekolah: hanya ADMIN yang boleh memanggil (dicek di route).
export async function notifySchool(schoolId: string, title: string, body: string): Promise<number> {
  const users = await runAsSchool(db, schoolId, (tx) =>
    tx.user.findMany({ where: { isActive: true }, select: { id: true }, take: 5000 }));
  for (const u of users) {
    await runAsSchool(db, schoolId, (tx) =>
      tx.notification.create({
        data: { schoolId, userId: u.id, title: title.slice(0, 200), body: body.slice(0, 2000) },
      }),
    );
  }
  return users.length;
}
