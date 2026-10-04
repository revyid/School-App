// Kontrak subdomain. Dipakai web (resolve Host) + validasi saat create school.
export const APEX_DOMAIN = process.env.APEX_DOMAIN ?? "domainmu.id";

// Tidak boleh jadi slug sekolah.
export const RESERVED_SUBDOMAINS = [
  "admin", "www", "api", "mail", "static", "cdn", "files",
  "status", "dev", "staging", "app", "login", "portal",
] as const;

// 1–63 char, huruf kecil/angka/hubung, tanpa hubung di ujung.
export const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  if (slug.startsWith("xn--")) return false; // tolak punycode/lookalike IDN
  return SLUG_RE.test(slug) &&
    !(RESERVED_SUBDOMAINS as readonly string[]).includes(slug);
}

// "<slug>.<apex>" → slug. Apex telanjang, reservasi, multi-level,
// format tak valid, atau prefiks xn-- → null.
export function schoolSlugFromHost(host: string, apex: string = APEX_DOMAIN): string | null {
  const h = host.split(":")[0].trim().toLowerCase();
  if (h === apex) return null;
  if (!h.endsWith("." + apex)) return null;
  const slug = h.slice(0, -(apex.length + 1));
  if (!slug || slug.includes(".")) return null;
  if (!isValidSlug(slug)) return null; // mencakup reservasi + xn-- + format
  return slug;
}
