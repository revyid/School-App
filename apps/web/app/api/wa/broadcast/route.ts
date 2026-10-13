import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { hit } from "@/server/rate-limit";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { normalizePhone } from "@sms/shared/notify";
import { enqueueOutbox } from "@/server/outbox";

async function gate(req: NextRequest) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["ADMIN"],
  });
}

// POST /api/wa/broadcast — ADMIN saja.
// Body: { classId?: string, template: string }
// Ambil parentPhone siswa per kelas (atau seluruh sekolah bila tanpa classId),
// render {nama}, enqueue per nomor. Return: { queued, skipped: [{name, reason}] }.
export async function POST(req: NextRequest) {
  const a = await gate(req);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const rl = await hit(`rl:wa-broadcast:${a.school.id}`, 1, 60);
  if (!rl.ok)
    return NextResponse.json(
      { error: `Terlalu sering — coba lagi dalam ${rl.retryAfter} detik` },
      { status: 429 },
    );

  const payload = await req.json().catch(() => null);
  const classId = typeof payload?.classId === "string" && payload.classId ? payload.classId : null;
  const template = String(payload?.template ?? "").trim();
  if (!template)
    return NextResponse.json({ error: "Template pesan wajib diisi" }, { status: 400 });

  const profiles = await runAsSchool(db, a.school.id, (tx) =>
    tx.studentProfile.findMany({
      where: { ...(classId ? { classId } : {}), user: { isActive: true } },
      include: { user: { select: { name: true } } },
      take: 5000,
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const tplHash = createHash("sha256").update(template).digest("hex").slice(0, 12);

  let queued = 0;
  const skipped: { name: string; reason: string }[] = [];
  for (const p of profiles) {
    const name = p.user?.name ?? "(tanpa nama)";
    const to = p.parentPhone ? normalizePhone(p.parentPhone) : null;
    if (!to) {
      skipped.push({ name, reason: p.parentPhone ? "nomor tidak valid" : "tanpa nomor ortu" });
      continue;
    }
    const text = template.replaceAll("{nama}", name);
    const dedupeKey = `broadcast-${a.school.id}-${tplHash}-${p.userId}-${today}`;
    const r = await enqueueOutbox(a.school.id, to, text, dedupeKey);
    if (r.duplicate) skipped.push({ name, reason: "sudah dikirim hari ini" });
    else queued += 1;
  }

  return NextResponse.json({ queued, skipped });
}
