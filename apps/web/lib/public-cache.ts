import { unstable_cache } from "next/cache";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { getRootDb } from "@lacakedu/db/root";

// Cache data PUBLIK (tanpa sesi) lintas request. Kunci cache selalu memuat
// slug sekolah: multi-tenant, jangan sampai data sekolah lain ikut terpakai.
// TTL pendek hanya jaring pengaman; jalur utama invalidasi = revalidateTag
// dari route admin (school:<slug> / root-settings).
const TTL = 60;

export const schoolTag = (slug: string) => `school:${slug}`;
export const ROOT_SETTINGS_TAG = "root-settings";

export type PublicSchool = {
  id: string;
  name: string;
  portalName: string;
  logoUrl: string | null;
  brandColor: string | null;
  branding: {
    characterImageUrl: string | null;
    bookImageUrl: string | null;
    siswaImageUrl: string | null;
    heroImageUrl: string | null;
    dashboardBannerUrl: string | null;
  };
};

export type PortalInfo = {
  school: { name: string; lat: number | null; lng: number | null };
  portalName: string;
  logoUrl: string | null;
  ctaGtkUrl: string | null;
  ctaMuridUrl: string | null;
  announcements: { id: string; title: string; body: string; publishAt: string }[];
  counts: { students: number; teachers: number; classes: number };
  subjects: { id: string; name: string }[];
};

export type PublicLegal = {
  id: string;
  name: string;
  portalName: string;
  policy: { text: string; updatedAt: string } | null;
};

export type PublicSchoolDirectory = {
  schools: { id: string; slug: string; name: string; url: string }[];
  total: number;
};

export type RootSettings = {
  heroImageUrl: string | null;
  platformLogoUrl: string | null;
  primaryColor: string | null;
  supportEmail: string | null;
  settings: { heroAlt: string; platformName: string; platformTagline: string };
};

// Identitas publik sekolah (nama, nama portal, logo). Null = slug tak dikenal.
export function getPublicSchool(slug: string): Promise<PublicSchool | null> {
  return unstable_cache(
    async (s: string) => {
      const school = await db.school.findFirst({
        where: { slug: s },
        select: { id: true, name: true },
      });
      if (!school) return null;
      const st = await runAsSchool(db, school.id, (tx) =>
        tx.schoolSettings.findUnique({
          where: { schoolId: school.id },
          select: { portalName: true, logoUrl: true, brandColor: true, characterImageUrl: true, bookImageUrl: true, siswaImageUrl: true, heroImageUrl: true, dashboardBannerUrl: true },
        })).catch(() => null);
      return {
        id: school.id,
        name: school.name,
        portalName: st?.portalName || school.name,
        logoUrl: st?.logoUrl ?? null,
        brandColor: st?.brandColor ?? null,
        branding: {
          characterImageUrl: st?.characterImageUrl ?? null,
          bookImageUrl: st?.bookImageUrl ?? null,
          siswaImageUrl: st?.siswaImageUrl ?? null,
          heroImageUrl: st?.heroImageUrl ?? null,
          dashboardBannerUrl: st?.dashboardBannerUrl ?? null,
        },
      };
    },
    ["public-school", slug],
    { tags: [schoolTag(slug)], revalidate: TTL },
  )(slug);
}

// Payload GET /api/portal/info, dihitung sekali per sekolah per TTL.
export function getPortalInfo(slug: string): Promise<PortalInfo | null> {
  return unstable_cache(
    async (s: string) => {
      const school = await db.school.findFirst({
        where: { slug: s },
        select: { id: true, name: true, lat: true, lng: true },
      });
      if (!school) return null;
      const sid = school.id;
      const st = await runAsSchool(db, sid, (tx) =>
        tx.schoolSettings.findUnique({ where: { schoolId: sid } }));
      const now = new Date();
      const announcements = await runAsSchool(db, sid, (tx) =>
        tx.announcement.findMany({
          where: { target: "ALL", publishAt: { lte: now } },
          select: { id: true, title: true, body: true, publishAt: true },
          orderBy: { publishAt: "desc" },
          take: 20,
        }));
      const [studentCount, teacherCount, classCount, subjects] = await Promise.all([
        runAsSchool(db, sid, (tx) => tx.studentProfile.count()),
        runAsSchool(db, sid, (tx) => tx.user.count({ where: { role: "GURU", isActive: true } })),
        runAsSchool(db, sid, (tx) => tx.class.count()),
        runAsSchool(db, sid, (tx) =>
          tx.subject.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 8 })),
      ]);
      return {
        school: { name: school.name, lat: school.lat, lng: school.lng },
        portalName: st?.portalName || school.name,
        logoUrl: st?.logoUrl ? "/api/portal/logo" : null,
        ctaGtkUrl: st?.ctaGtkUrl ?? null,
        ctaMuridUrl: st?.ctaMuridUrl ?? null,
        announcements: announcements.map((a) => ({ ...a, publishAt: a.publishAt.toISOString() })),
        counts: { students: studentCount, teachers: teacherCount, classes: classCount },
        subjects,
      };
    },
    ["portal-info", slug],
    { tags: [schoolTag(slug)], revalidate: TTL },
  )(slug);
}

// Data halaman legal: nama sekolah + kebijakan privasi khusus (bila ada).
export function getPublicLegal(slug: string): Promise<PublicLegal | null> {
  return unstable_cache(
    async (s: string) => {
      const school = await db.school.findFirst({
        where: { slug: s },
        select: { id: true, name: true },
      });
      if (!school) return null;
      const legal: PublicLegal = {
        id: school.id,
        name: school.name,
        portalName: school.name,
        policy: null,
      };
      try {
        const st = await runAsSchool(db, school.id, (tx) =>
          tx.schoolSettings.findUnique({
            where: { schoolId: school.id },
            select: { portalName: true },
          }));
        if (st?.portalName) legal.portalName = st.portalName;
        const p = await runAsSchool(db, school.id, (tx) =>
          tx.privacyPolicy.findUnique({
            where: { schoolId: school.id },
            select: { text: true, updatedAt: true },
          }));
        if (p?.text.trim()) {
          legal.policy = { text: p.text.trim(), updatedAt: p.updatedAt.toISOString() };
        }
      } catch { /* fallback ke teks bawaan */ }
      return legal;
    },
    ["public-legal", slug],
    { tags: [schoolTag(slug)], revalidate: TTL },
  )(slug);
}

// Direktori sekolah untuk landing platform (apex).
export function getPublicSchools(): Promise<PublicSchoolDirectory> {
  return unstable_cache(
    async () => {
      const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
      const schools = await db.school.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { name: "asc" },
      });
      return {
        schools: schools.map((s) => ({ ...s, url: `https://${s.slug}.${apex}` })),
        total: schools.length,
      };
    },
    ["public-schools"],
    { tags: ["public-schools"], revalidate: TTL },
  )();
}

// RootSettings platform (dibaca konsol root; tag global root-settings).
export function getRootSettings(): Promise<RootSettings> {
  return unstable_cache(
    async () => {
      const rows = await getRootDb().$queryRaw<{ key: string; value: unknown }[]>`
        SELECT key, value FROM "RootSettings"
        WHERE key IN ('heroImageUrl', 'heroAlt', 'platformName', 'platformTagline',
                      'platformLogoUrl', 'primaryColor', 'supportEmail')`;
      const val = (key: string) => {
        const v = rows.find((r) => r.key === key)?.value;
        return typeof v === "string" ? v : "";
      };
      return {
        heroImageUrl: val("heroImageUrl") || null,
        platformLogoUrl: val("platformLogoUrl") || null,
        primaryColor: val("primaryColor") || null,
        supportEmail: val("supportEmail") || null,
        settings: {
          heroAlt: val("heroAlt"),
          platformName: val("platformName"),
          platformTagline: val("platformTagline"),
        },
      };
    },
    ["root-settings"],
    { tags: [ROOT_SETTINGS_TAG], revalidate: TTL },
  )();
}

// Flag fitur platform (RootSettings.featureFlags). Default: semua MATI.
// Di-cache 60 detik; invalidasi lewat tag root-settings (dipanggil route settings).
export type PlatformFlags = {
  aiChat: boolean;
  waBroadcast: boolean;
  ebook: boolean;
  qrAttendance: boolean;
  studentImport: boolean;
};

// Default = fitur yang sudah aktif sebelum flag diperkenalkan (bukan mati,
// biar rollout tidak mematikan fitur yang sedang dipakai). Nilai eksplisit di
// RootSettings selalu menang.
const FLAG_DEFAULTS: PlatformFlags = {
  aiChat: true,
  waBroadcast: true,
  ebook: true,
  qrAttendance: true,
  studentImport: true,
};

export function getPlatformFlags(): Promise<PlatformFlags> {
  return unstable_cache(
    async () => {
      try {
        const rows = await getRootDb().$queryRaw<{ key: string; value: unknown }[]>`
          SELECT key, value FROM "RootSettings" WHERE key = 'featureFlags'`;
        const raw = rows[0]?.value;
        const obj = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
        return {
          aiChat: obj?.aiChat === true,
          waBroadcast: obj?.waBroadcast === true,
          ebook: obj?.ebook === true,
          qrAttendance: obj?.qrAttendance === true,
          studentImport: obj?.studentImport === true,
        };
      } catch {
        return FLAG_DEFAULTS;
      }
    },
    ["root-platform-flags"],
    { revalidate: 60, tags: ["root-settings"] },
  )();
}
