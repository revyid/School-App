import { randomBytes } from "node:crypto";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

// Password awal akun mengikuti setting admin `defaultPasswordMode`:
// - "nisn": pakai NISN/NIP bila panjangnya >= 4, fallback acak.
// - "random" (default): selalu acak 12 char base64url.
export async function resolveDefaultPassword(
  schoolId: string,
  identifier?: string | null,
): Promise<{ password: string; mode: "nisn" | "random" }> {
  const s = await runAsSchool(db, schoolId, (tx) =>
    tx.schoolSettings.findUnique({ where: { schoolId }, select: { defaultPasswordMode: true } }),
  ).catch(() => null);
  const mode = s?.defaultPasswordMode === "nisn" ? "nisn" : "random";
  const id = (identifier ?? "").trim();
  if (mode === "nisn" && id.length >= 4) return { password: id, mode };
  return { password: randomBytes(9).toString("base64url"), mode };
}
