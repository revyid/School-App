// Ambil thumbnail otomatis dari sebuah URL (halaman web / dokumen).
// Halaman web -> og:image / twitter:image / <img> pertama; pdf/docx -> null.
//
// Anti-SSRF (audit 2026-10):
//  - redirect "manual": TIAP hop divalidasi ulang (redirect bisa menuju IP privat)
//  - DNS di-resolve SENDIRI lalu semua alamatnya dicek -> anti DNS-rebinding (TOCTOU)
//  - cek alamat via nilai hasil lookup (kanonik), bukan regex hostname
//    (menutup bypass 0x7f000001 / 2130706433 / ::ffff:10.x.x.x)
//  - body HTML ≤ 1 MB, timeout 4 s.

import { lookup } from "node:dns/promises";
import net from "node:net";

function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const o = ip.split(".").map(Number);
    const [a, b] = o as [number, number];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (v === 6) {
    const lo = ip.toLowerCase();
    // ::ffff:x.x.x.x = IPv4 ter-mapping -> cek bagian IPv4-nya
    if (lo.startsWith("::ffff:")) return isPrivateIp(lo.slice(7));
    return lo === "::" || lo === "::1" || lo.startsWith("fc") || lo.startsWith("fd") || lo.startsWith("fe8");
  }
  return true; // format tak dikenal: tolak
}

async function assertPublicHost(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  // Selalu resolve dulu: memblokir DNS rebinding & hostname numerik yang jadi IP privat.
  const addrs = await lookup(host, { all: true }).catch(() => null);
  if (!addrs || addrs.length === 0) return false;
  if (addrs.some((a) => isPrivateIp(a.address))) return false;
  return true;
}

const OG_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const OG_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i;
const TW_RE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const IMG_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;

async function fetchHtml(url: string): Promise<Response | null> {
  if (!(await assertPublicHost(url))) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "manual", // hop berikutnya divalidasi ulang oleh pemanggil
      headers: { "user-agent": "Lacakedu/1.0 (+book thumbnail)", accept: "text/html,*/*" },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  let url = pageUrl;
  try {
    let res = await fetchHtml(url);
    for (let hops = 0; hops < 3 && res && res.status >= 300 && res.status < 400; hops++) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      url = new URL(loc, url).toString();
      res = await fetchHtml(url);
    }
    if (!res || !res.ok) return null;
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
      const abs = new URL(img, url).toString();
      // Gambar hasil ekstraksi juga harus publik (jangan jadi proksi internal).
      return (await assertPublicHost(abs)) ? abs : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
