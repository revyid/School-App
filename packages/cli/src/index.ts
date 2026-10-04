#!/usr/bin/env node
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { isValidSlug } from "@sms/shared/school";
import { dbSystem } from "./system.js";

const usage = `pakai: sms-admin create-school <slug> <nama>
       sms-admin create-admin <schoolSlug> <email> <nama>
       sms-admin reset-password <schoolSlug> <email-atau-nisn>`;

async function audit(schoolId: string, action: string, meta: object) {
  await dbSystem.auditLog.create({ data: { schoolId, actorId: null, action, meta } });
}

async function createSchool(slug: string, name: string) {
  if (!isValidSlug(slug)) throw new Error(`slug tidak valid: ${slug}`);
  const s = await dbSystem.school.create({ data: { slug, name } });
  console.log(`sekolah dibuat: ${s.id} (${s.slug})`);
}

async function createAdmin(schoolSlug: string, email: string, name: string) {
  const school = await dbSystem.school.findUnique({ where: { slug: schoolSlug } });
  if (!school) throw new Error("sekolah tidak ditemukan");
  const pw = randomBytes(12).toString("base64url");
  const u = await dbSystem.user.create({
    data: {
      schoolId: school.id,
      role: "ADMIN",
      email: email.toLowerCase(),
      name,
      passwordHash: await argon2.hash(pw, { type: argon2.argon2id }),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
    },
  });
  await audit(school.id, "ADMIN.CREATE", { userId: u.id, via: "cli" });
  console.log(`admin dibuat: ${email}\npassword awal (tampil sekali, wajib diganti saat login pertama):\n${pw}`);
}

async function resetPassword(schoolSlug: string, identifier: string) {
  const school = await dbSystem.school.findUnique({ where: { slug: schoolSlug } });
  if (!school) throw new Error("sekolah tidak ditemukan");
  const id = identifier.trim();
  const user = id.includes("@")
    ? await dbSystem.user.findFirst({ where: { schoolId: school.id, email: { equals: id, mode: "insensitive" } } })
    : await dbSystem.user.findFirst({ where: { schoolId: school.id, nisn: id } });
  if (!user) throw new Error("user tidak ditemukan");
  const pw = randomBytes(12).toString("base64url");
  await dbSystem.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await argon2.hash(pw, { type: argon2.argon2id }),
      passwordChangedAt: new Date(),
      mustChangePassword: true,
    },
  });
  await audit(school.id, "ADMIN.PASSWORD_RESET", { userId: user.id, via: "cli" });
  console.log(`password baru untuk ${identifier} (wajib diganti saat login):\n${pw}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === "create-school" && rest.length === 2) await createSchool(rest[0], rest[1]);
    else if (cmd === "create-admin" && rest.length === 3) await createAdmin(rest[0], rest[1], rest[2]);
    else if (cmd === "reset-password" && rest.length === 2) await resetPassword(rest[0], rest[1]);
    else {
      console.log(usage);
      process.exit(2);
    }
  } catch (e) {
    console.error(`gagal: ${(e as Error).message}`);
    process.exit(1);
  } finally {
    await dbSystem.$disconnect();
  }
}

await main();
