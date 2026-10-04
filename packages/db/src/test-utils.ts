// Helper TEST-ONLY. Tidak ada dependensi ke @sms/cli.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma.js";

const url = process.env.SYSTEM_URL;
if (!url) throw new Error("SYSTEM_URL belum di-set (TEST-ONLY)");
export const dbSystemTest: PrismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
