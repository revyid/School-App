// Kontrak subdomain. Dipakai web (resolve Host) + validasi saat create school.
export const APEX_DOMAIN = process.env.APEX_DOMAIN ?? "domainmu.id";

// Tidak boleh jadi slug sekolah.
export const RESERVED_SUBDOMAINS = [
  "admin", "www", "api", "mail", "static", "cdn", "files",
  "status", "dev", "staging", "app", "login", "portal",
] as const;

// Alias host untuk development lokal (tunnel dev.revy.my.id, localtest.me).
// Hanya boleh dipercaya saat NODE_ENV !== "production": di produksi domain
// ini bisa dialihkan/di-take-over sehingga jalur origin & console root bocor.
export const DEV_HOSTS = ["localtest.me", "dev.revy.my.id", "revy.my.id"] as const;

const isDev = () => process.env.NODE_ENV !== "production";

// Host yang melayani root (apex): apex produksi, atau alias dev saat dev.
export function isRootHost(bare: string, apex: string = APEX_DOMAIN): boolean {
  const h = bare.split(":")[0].trim().toLowerCase();
  if (h === apex.toLowerCase()) return true;
  return !isDev() ? false : (DEV_HOSTS as readonly string[]).includes(h);
}

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
  
  // Alias dev hanya saat NODE_ENV !== "production".
  const knownApexes = Array.from(
    new Set([apex, ...(isDev() ? DEV_HOSTS : [])]),
  ).filter(Boolean);
  // Mode satu sekolah: root (apex) melayani sekolah utama ini.
  const apexSchool = (process.env.APEX_SCHOOL_SLUG ?? "").trim().toLowerCase();
  
  for (const a of knownApexes) {
    if (h === a) {
      if (a === apex && apexSchool && isValidSlug(apexSchool)) return apexSchool;
      continue;
    }
    if (h.endsWith("." + a)) {
      const slug = h.slice(0, -(a.length + 1));
      if (slug && !slug.includes(".") && isValidSlug(slug)) return slug;
    }
  }
  return null;
}
