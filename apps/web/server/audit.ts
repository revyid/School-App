import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";

export function logAuth(schoolId: string, action: string, o: { actorId?: string; ip?: string; meta?: object }) {
  return runAsSchool(db, schoolId, (tx) =>
    tx.auditLog.create({
      data: { schoolId, actorId: o.actorId ?? null, action, ip: o.ip ?? null, meta: o.meta ?? {} },
    }));
}
