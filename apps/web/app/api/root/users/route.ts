import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole } from "@/server/auth-gate";
import { getRootDb } from "@lacakedu/db/root";

const ROLES = ["ADMIN", "GURU", "SISWA"] as const;
type RootRole = (typeof ROLES)[number];

// GET /api/root/users?page&perPage&q&role&schoolId — SUPER_ADMIN lintas sekolah.
// Akun platform (role SUPER_ADMIN) dikecualikan.
export async function GET(req: NextRequest) {
  const a = await requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: ["SUPER_ADMIN"],
  });
  if (!a.ok) return NextResponse.json({ error: a.error }, { status: a.status });

  const url = new URL(req.url);
  // Konsol root memuat banyak baris sekaligus (filter klien) — batas longgar.
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const perPage = Math.min(500, Math.max(1, Number(url.searchParams.get("perPage") ?? 100) || 100));
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 128);
  const roleParam = url.searchParams.get("role") ?? "";
  if (roleParam && !(ROLES as readonly string[]).includes(roleParam)) {
    return NextResponse.json({ error: "role tidak valid" }, { status: 400 });
  }
  const schoolId = (url.searchParams.get("schoolId") ?? "").slice(0, 64);

  const where = {
    role: roleParam ? (roleParam as RootRole) : ({ not: "SUPER_ADMIN" } as const),
    ...(schoolId ? { schoolId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const root = getRootDb();
  const [rows, total] = await Promise.all([
    root.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        nisn: true,
        role: true,
        isActive: true,
        school: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    root.user.count({ where }),
  ]);
  return NextResponse.json({ rows, total });
}
