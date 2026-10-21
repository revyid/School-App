import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPageAuth } from "@/app/lib/require-page";
import DashShell, { type MenuItem } from "@/components/DashShell";

// U1: menu per peran — maks 7 item utama, ikon via string key MENU_ICONS (bukan komponen langsung).
const MENUS: Record<string, { utama: MenuItem[]; lainnya: MenuItem[]; groups?: { label: string; items: MenuItem[] }[] }> = {
  SISWA: {
    utama: [
      { href: "/siswa", label: "Dasbor", icon: "dasbor" },
      { href: "/siswa/kelasku", label: "Kelasku", icon: "kelas" },
      { href: "/siswa/jadwal", label: "Jadwal", icon: "jadwal" },
      { href: "/siswa/inbox", label: "Pesan", icon: "inbox" },
      { href: "/siswa/izin", label: "Izin", icon: "izin" },
    ],
    lainnya: [
      { href: "/siswa/leaderboard", label: "Papan peringkat", icon: "nilai" },
      { href: "/siswa/profil", label: "Profil", icon: "profil" },
    ],
  },
  GURU: {
    utama: [
      { href: "/guru", label: "Dasbor", icon: "dasbor" },
      { href: "/guru/kelas-saya", label: "Kelas saya", icon: "kelas" },
      { href: "/guru/tugas", label: "Tugas", icon: "tugas" },
      { href: "/guru/jadwal", label: "Jadwal", icon: "jadwal" },
      { href: "/guru/kehadiran", label: "Kehadiran", icon: "kehadiran" },
      { href: "/guru/inbox", label: "Pesan", icon: "inbox" },
      { href: "/guru/rapor", label: "Rapor", icon: "rapor" },
    ],
    lainnya: [
      { href: "/guru/izin", label: "Izin siswa", icon: "izin" },
    ],
  },
  ADMIN: {
    utama: [
      { href: "/admin", label: "Dasbor", icon: "dasbor" },
    ],
    lainnya: [],
    groups: [
      { label: "Data", items: [
        { href: "/admin/pengguna", label: "Pengguna", icon: "siswa" },
        { href: "/admin/kelas", label: "Kelas", icon: "kelas" },
        { href: "/admin/mapel", label: "Mapel", icon: "materi" },
      ]},
      { label: "Akademik", items: [
        { href: "/admin/jadwal", label: "Jadwal", icon: "jadwal" },
        { href: "/admin/kehadiran", label: "Kehadiran", icon: "kehadiran" },
      ]},
      { label: "Komunikasi", items: [
        { href: "/admin/pengumuman", label: "Pengumuman", icon: "pengumuman" },
        { href: "/admin/notifikasi", label: "Notifikasi", icon: "notifikasi" },
        { href: "/admin/inbox", label: "Inbox", icon: "inbox" },
        { href: "/admin/wa", label: "WA", icon: "whatsapp" },
      ]},
      { label: "Sistem", items: [
        { href: "/admin/pengaturan", label: "Pengaturan", icon: "pengaturan" },
        { href: "/admin/privasi", label: "Privasi", icon: "privasi" },
        { href: "/admin/audit", label: "Audit", icon: "audit" },
      ]},
    ],
  },
};

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  // Root-admin punya shell sendiri: jangan lewat gate tenant di sini.
  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const bare = (h.get("host") ?? "").split(":")[0].trim().toLowerCase();
  const isRoot = bare === apex || bare === "localtest.me" || bare === "dev.revy.my.id";
  if (isRoot && (path === "/admin" || path.startsWith("/admin/"))) return <>{children}</>;
  if (path === "/pantau" || path.startsWith("/pantau/")) return <>{children}</>;

  // F4: satu authorize + satu query user/settings per navigasi (React.cache).
  const a = await getPageAuth();
  if (!a.ok) redirect(a.redirectTo);
  const me = a.me;
  const menus = MENUS[me.role] ?? MENUS.SISWA;
  return (
    <DashShell
      role={me.role as "ADMIN" | "GURU" | "SISWA"}
      userName={me.name}
      schoolName={a.schoolName}
      menus={menus}
    >
      {children}
    </DashShell>
  );
}
