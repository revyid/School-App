import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { db } from "@sms/db/client";
import { runAsSchool } from "@sms/db/tenant";
import { profilePatchSchema } from "@sms/shared/master";

async function gate(req: NextRequest, roles: ("ADMIN" | "GURU" | "SISWA")[]) {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles,
  });
}

// GET /api/profile
export async function GET(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const user = await runAsSchool(db, a.school.id, (tx) =>
    tx.user.findUnique({
      where: { id: a.userId },
      select: {
        id: true, name: true, email: true, nisn: true, role: true,
        studentProfile: {
          select: { avatarUrl: true, bio: true, class: { select: { id: true, name: true } } },
        },
      },
    }),
  );
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// PATCH /api/profile — bio (GURU/SISWA), nama tampil dibatasi admin.
export async function PATCH(req: NextRequest) {
  const a = await gate(req, ["ADMIN", "GURU", "SISWA"]);
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });
  const body = profilePatchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "input tidak valid" }, { status: 400 });
  if (a.role === "SISWA") {
    await runAsSchool(db, a.school.id, (tx) =>
      tx.studentProfile.upsert({
        where: { userId: a.userId },
        update: { bio: body.data.bio ?? null },
        create: { schoolId: a.school.id, userId: a.userId, bio: body.data.bio ?? null },
      }),
    );
  }
  // GURU/ADMIN: bio disimpan di StudentProfile hanya untuk siswa; guru cukup 200 OK tanpa-op.
  return NextResponse.json({ ok: true });
}
