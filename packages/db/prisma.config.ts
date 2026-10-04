import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // CLI (migrate/generate) memakai URL ini.
  // Saat MIGRASI: MIGRATE_URL = owner `sms` (superuser, = POSTGRES_USER).
  // DATABASE_URL (app_user) TIDAK dipakai untuk migrasi.
  datasource: { url: env("MIGRATE_URL") },
});
