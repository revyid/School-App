// Next 16: Proxy. Auth penuh di authorize(); proxy hanya routing kasar + nonce CSP.
import { NextResponse, type NextRequest } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { SESSION_COOKIE } from "@sms/shared/auth";

const apex = process.env.APEX_DOMAIN ?? "domainmu.id";

const PWA_ASSETS = new Set([
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/sw.js",
  "/sw-push.js",
  "/icon-192.png",
  "/icon-512.png",
]);

// Cocokkan SEGMEN penuh: /publicity tidak lolos sebagai /public.
// Root "/" + "/perkakas" + "/anonim" = publik per sekolah (guest maupun login boleh melihat).
function isPublic(path: string): boolean {
  if (path === "/" || path === "/syarat" || path === "/privasi" || path === "/perkakas/buku" || path === "/buku" || path === "/login" || path === "/change-password" || path === "/anonim" || path.startsWith("/api/anonim")) return true;
  if (PWA_ASSETS.has(path)) return true;
  const seg = path.split("/").filter(Boolean)[0] ?? "";
  return seg === "portal" || seg === "public" || seg === "perkakas" || seg === "tools";
}

// Halaman super-admin (hanya di admin.<apex>). Data tetap dijaga API requireRole.
function isAdminPage(path: string): boolean {
  return path === "/admin-login" || path === "/pantau";
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const bare = host.split(":")[0].trim().toLowerCase();
  const isAdminHost = bare === `admin.${apex}` || bare === "admin.localtest.me" || bare === "admin.dev.revy.my.id";
  const slug = schoolSlugFromHost(host, apex);
  if (!slug && !isAdminHost) return new NextResponse("not found", { status: 404 });
  // Nama cookie tergantung env (prod __Host-session, dev sms-session-dev).
  // Proxy tidak boleh bergantung pada env yang belum tentu tersedia di runtime-nya,
  // jadi terima KEDUANYA di sini. Otorisasi penuh tetap di authorize().
  const hasSession =
    (req.cookies.get(SESSION_COOKIE)?.value ?? "").length > 0 ||
    (req.cookies.get("__Host-session")?.value ?? "").length > 0 ||
    (req.cookies.get("sms-session-dev")?.value ?? "").length > 0;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const connectHost = isAdminHost ? `admin.${apex}` : `${slug}.${apex}`;
  const isDev = process.env.NODE_ENV === "development";
  const path = req.nextUrl.pathname;
  // /perkakas/peta memuat tile peta + routing publik (tanpa login, client-side).
  const isTools = path === "/perkakas" || path.startsWith("/perkakas/") || path === "/tools" || path.startsWith("/tools/");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://covers.openlibrary.org https://tile.openstreetmap.org",
    // Dev (next dev): HMR pakai ws:// + port; prod: hanya wss:// apex.
    isDev
      ? `connect-src 'self' ws: wss: http: https:`
      : `connect-src 'self' wss://${connectHost}${isTools ? " https://router.project-osrm.org https://nominatim.openstreetmap.org" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("x-pathname", req.nextUrl.pathname);
  reqHeaders.set("Content-Security-Policy", csp);

  // Tanpa sesi, /change-password tidak berguna (API menolak) -> arahkan ke /login.
  // (Halaman /login sendiri tetap publik.)
  if (path === "/change-password" && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const r = NextResponse.redirect(url);
    r.headers.set("Content-Security-Policy", csp);
    return r;
  }

  if (isAdminPage(path)) {
    // Halaman admin hanya di host admin; proteksi data tetap di tiap API.
    if (!isAdminHost) return new NextResponse("not found", { status: 404 });
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  if (isPublic(path)) {
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // redirect: opsi `request` hanya berlaku untuk next()/rewrite(), bukan redirect.
    const r = NextResponse.redirect(url);
    r.headers.set("Content-Security-Policy", csp);
    return r;
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|assets|fonts|manifest.webmanifest|sw.js|icon-.*\\.png).*)"],
};
