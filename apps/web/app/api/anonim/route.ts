import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { logAuth } from "@/server/audit";
import { ipOf } from "@/server/request-ip";

const apex = () => process.env.APEX_DOMAIN ?? "localtest.me";

// In-memory rate limiter per IP (maks 5 kirim per jam)
const ipHits = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || now > rec.reset) {
    ipHits.set(ip, { count: 1, reset: now + 3600000 });
    return false;
  }
  if (rec.count >= 5) return true;
  rec.count += 1;
  return false;
}

// POST /api/anonim — Kirim pesan anonim publik tanpa login
export async function POST(req: NextRequest) {
  const ip = ipOf(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak pesan dari perangkat ini. Coba lagi dalam 1 jam." },
      { status: 429 }
    );
  }

  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, apex());
  if (!slug) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });

  const school = await db.school.findFirst({ where: { slug } });
  if (!school) return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
  }

  const { subject, message } = body as { subject?: string; message?: string };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subjek dan isi pesan wajib diisi" }, { status: 400 });
  }

  const created = await runAsSchool(db, school.id, async (tx) => {
    // Penerima: semua guru aktif di sekolah ini, diteruskan lewat collabThread.
    // Tidak memakai notification.createMany (tidak memicu notifikasi/WS/push).
    const teachers = await tx.user.findMany({
      where: { schoolId: school.id, role: "GURU", isActive: true },
      select: { id: true, name: true },
    });

    if (teachers.length === 0) return null;

    const thread = await tx.collabThread.create({
      data: {
        schoolId: school.id,
        senderId: null,
        subject: subject.trim(),
        anonymous: true,
        recipients: teachers.map((t) => t.id),
        messages: {
          create: { schoolId: school.id, authorId: null, body: message.trim() },
        },
      },
    });

    return { id: thread.id, recipients: teachers.map((t) => t.id) };
  });

  if (!created) {
    return NextResponse.json({ error: "Tidak ada penerima pesan di sekolah ini" }, { status: 404 });
  }

  await logAuth(school.id, "ANONIM.CREATE", { meta: created });

  return NextResponse.json({
    success: true,
    message: "Pesan anonim berhasil terkirim ke pihak sekolah.",
  });
}
