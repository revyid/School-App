// Ambil thumbnail otomatis dari sebuah URL (halaman web / dokumen).
//
// Yang dipakai:
//  1. Halaman web  -> cari <meta property="og:image"> (fallback twitter:image / <img> pertama)
//  2. Dokumen      -> meistnya tidak ada gambar -> null (pakai placeholder)
//
// Keamanan: URL dicek dulu supaya tidak menunjuk ke jaringan internal (SSRF):
// hanya http/https, host bukan IP privat/loopback/link-local, dan respons dibatasi 1 MB.

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
const PRIVATE_V6 = [/^::1$/, /^fc/i, /^fd/i, /^fe80/i];

export function isPublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    if (PRIVATE_V4.some((r) => r.test(host))) return false;
  }
  if (host.includes(":")) {
    if (PRIVATE_V6.some((r) => r.test(host))) return false;
  }
  return true;
}

const OG_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const OG_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i;
const TW_RE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const IMG_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;

export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  if (!isPublicUrl(pageUrl)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Lacakedu/1.0 (+book thumbnail)", accept: "text/html,*/*" },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null; // pdf/docx: tidak ada gambar
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 1_000_000) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        size += value.byteLength;
      }
    }
    reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    const m = OG_RE.exec(html) ?? OG_RE_ALT.exec(html) ?? TW_RE.exec(html) ?? IMG_RE.exec(html);
    if (!m?.[1]) return null;
    let img = m[1].trim();
    if (img.startsWith("//")) img = "https:" + img;
    try {
      return new URL(img, pageUrl).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
