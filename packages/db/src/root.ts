import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

// Koneksi root (app_root, BYPASSRLS) HANYA untuk endpoint /api/root/*.
// Jangan pakai di route tenant — RLS dimatikan oleh role ini.
let _root: PrismaClient | null = null;

function init(): PrismaClient {
  const cs = process.env.ROOT_DATABASE_URL;
  if (!cs) throw new Error("ROOT_DATABASE_URL belum di-set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });
}

export function getRootDb(): PrismaClient {
  if (!_root) _root = init();
  return _root;
}

// Proxy lazy: throw baru terjadi saat query pertama, bukan saat import.
export const dbRoot: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, p) {
    const t = getRootDb() as unknown as Record<PropertyKey, unknown>;
    const v = t[p];
    return typeof v === "function" ? (v as unknown as () => unknown).bind(t) : v;
  },
});
