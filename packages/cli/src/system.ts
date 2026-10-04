// Pemilik tunggal dbSystem (app_system BYPASSRLS via SYSTEM_URL).
// Dipakai @sms/cli saja. Class PrismaClient dari @sms/db/prisma (tanpa path relatif).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@sms/db/prisma";

const url = process.env.SYSTEM_URL;
if (!url) throw new Error("SYSTEM_URL belum di-set");
export const dbSystem = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
