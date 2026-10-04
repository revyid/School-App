import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

export { PrismaClient };

let _db: PrismaClient | null = null;

function init(): PrismaClient {
  const cs = process.env.DATABASE_URL;
  if (!cs) throw new Error("DATABASE_URL belum di-set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });
}

export function getDb(): PrismaClient {
  if (!_db) _db = init();
  return _db;
}

// Proxy lazy: throw baru terjadi saat query pertama, bukan saat import
// (agar `next build` tidak gagal tanpa DATABASE_URL).
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, p) {
    const t = getDb() as unknown as Record<PropertyKey, unknown>;
    const v = t[p];
    return typeof v === "function" ? (v as unknown as () => unknown).bind(t) : v;
  },
});
