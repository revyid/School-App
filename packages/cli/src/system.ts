// Pemilik tunggal dbSystem (app_system BYPASSRLS via SYSTEM_URL).
// Dipakai @lacakedu/cli saja. Class PrismaClient dari @lacakedu/db/prisma (tanpa path relatif).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@lacakedu/db/prisma";

const url = process.env.SYSTEM_URL;
if (!url) throw new Error("SYSTEM_URL belum di-set");
export const dbSystem: PrismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
