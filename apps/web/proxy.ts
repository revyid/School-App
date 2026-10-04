// Next 16: Proxy. Auth penuh di authorize(); proxy hanya routing kasar + nonce CSP.
import { NextResponse, type NextRequest } from "next/server";
import { schoolSlugFromHost } from "@sms/shared/school";
import { SESSION_COOKIE } from "@sms/shared/auth";

const apex = process.env.APEX_DOMAIN ?? "domainmu.id";

// Cocokkan SEGMEN penuh: /publicity tidak lolos sebagai /public.
function isPublic(path: string): boolean {
  if (path === "/login" || path === "/change-password") return true;
  const seg = path.split("/").filter(Boolean)[0] ?? "";
  return seg === "portal" || seg === "public";
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = schoolSlugFromHost(host, apex);
  if (!slug) return new NextResponse("not found", { status: 404 });

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src 'self' wss://${slug}.${apex}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("x-pathname", req.nextUrl.pathname);
  reqHeaders.set("Content-Security-Policy", csp);

  const path = req.nextUrl.pathname;
  if (isPublic(path)) {
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  }

  const hasCookie = (req.cookies.get(SESSION_COOKIE)?.value ?? "").length > 0;
  if (!hasCookie) {
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
