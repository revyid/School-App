import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@sms/db/root";

// POST /api/root/users/[id]/active — SUPER_ADMIN: aktif/nonaktifkan pengguna lintas sekolah.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: true,
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const { id } = await params;
  const root = getRootDb();
  const u = await root.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!u) return NextResponse.json({ error: "pengguna tidak ditemukan" }, { status: 404 });
  // Akun platform (SUPER_ADMIN) tidak boleh dinonaktifkan: bisa mengunci
  // satu-satunya akses root.
  if (u.role === "SUPER_ADMIN")
    return NextResponse.json({ error: "akun platform tidak bisa dinonaktifkan" }, { status: 400 });

  const isActive = !u.isActive;
  const updated = await root.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, isActive: true },
  });
  return NextResponse.json({ ok: true, user: updated });
}
