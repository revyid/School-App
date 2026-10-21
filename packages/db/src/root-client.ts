import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

// Koneksi root (role app_root, BYPASSRLS) untuk baca lintas-sekolah.
// Terpisah total dari `db` (DATABASE_URL / app_user) milik tier publik.
export function createRootClient(): PrismaClient {
  const cs = process.env.ROOT_DATABASE_URL;
  if (!cs) throw new Error("ROOT_DATABASE_URL belum di-set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: cs }) });
}
