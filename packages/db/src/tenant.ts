// SATU-SATUNYA jalan query data tenant.
import type { Prisma, PrismaClient } from "./generated/client.js";

export interface TenantOpts {
  timeout?: number; // job import Fase 2: { timeout: 60_000, maxWait: 10_000 }
  maxWait?: number;
}

export function assertSchoolId(schoolId: string): void {
  if (!schoolId || /[^A-Za-z0-9_-]/.test(schoolId)) throw new Error("invalid schoolId");
}

export async function runAsSchool<T>(
  db: PrismaClient,
  schoolId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  opts?: TenantOpts,
): Promise<T> {
  assertSchoolId(schoolId);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.school_id', ${schoolId}, true)`;
      return fn(tx);
    },
    {
      isolationLevel: "ReadCommitted",
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
      ...(opts?.maxWait ? { maxWait: opts.maxWait } : {}),
    },
  );
}
