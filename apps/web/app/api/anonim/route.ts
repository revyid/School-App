import { NextRequest, NextResponse } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";

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
  const ip = req.headers.get("x-real-ip")?.split(",")[0].trim() || "unknown";
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

  const { subject, message, senderAlias } = body as {
    subject?: string;
    message?: string;
    senderAlias?: string;
  };

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Subjek dan isi pesan wajib diisi" }, { status: 400 });
  }

  return runAsSchool(db, school.id, async (tx) => {
    // Cari admin atau guru utama sekolah untuk menerima notifikasi pesan publik
    const targetAdmins = await tx.user.findMany({
      where: { schoolId: school.id, role: { in: ["ADMIN", "GURU"] }, isActive: true },
      take: 5,
    });

    if (targetAdmins.length === 0) {
      return NextResponse.json({ error: "Tidak ada penerima pesan di sekolah ini" }, { status: 404 });
    }

    const alias = senderAlias?.trim() || "Masyarakat Umum";
    const title = `[CTA Anonim] ${subject.trim()}`;
    const notifBody = `Pesan publik dari ${alias}:\n\n${message.trim()}`;

    // Buat notifikasi ke seluruh admin/guru penerima
    await tx.notification.createMany({
      data: targetAdmins.map((u) => ({
        schoolId: school.id,
        userId: u.id,
        title,
        body: notifBody,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: "Pesan anonim berhasil terkirim ke pihak sekolah.",
    });
  });
}
