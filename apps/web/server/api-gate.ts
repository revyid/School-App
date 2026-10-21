import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@lacakedu/shared/auth";
import { requireRole, type SuperAuth, type TenantAuth } from "./auth-gate";

// Pengganti fungsi gate() yang di-copy di tiap route.ts — perilaku auth identik.
// Overload disalin dari requireRole agar school non-null menyempit untuk tenant.
export function apiGate(
  req: NextRequest,
  roles: ["SUPER_ADMIN"],
): Promise<SuperAuth | { ok: false; status: number; error: string }>;
export function apiGate(
  req: NextRequest,
  roles: ("ADMIN" | "GURU" | "SISWA")[],
): Promise<TenantAuth | { ok: false; status: number; error: string }>;
export function apiGate(req: NextRequest, roles: ["SUPER_ADMIN"] | ("ADMIN" | "GURU" | "SISWA")[]): Promise<SuperAuth | TenantAuth | { ok: false; status: number; error: string }> {
  return requireRole({
    host: req.headers.get("host") ?? "",
    token: req.cookies.get(SESSION_COOKIE)?.value,
    pathname: new URL(req.url).pathname,
    mutation: req.method !== "GET",
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    csrf: req.headers.get("x-csrf-token"),
    roles: roles as ("ADMIN" | "GURU" | "SISWA")[],
  });
}
