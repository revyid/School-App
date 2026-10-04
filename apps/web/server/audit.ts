import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

export function logAuth(schoolId: string, action: string, o: { actorId?: string; ip?: string; meta?: object }) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.auditLog.create({
      data: { schoolId, actorId: o.actorId ?? null, action, ip: o.ip ?? null, meta: o.meta ?? {} },
    }));
}
