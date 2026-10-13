import { redirect } from "next/navigation";
import { getPageAuth } from "@/app/lib/require-page";
import DashShell, { type MenuItem } from "@/components/DashShell";

// U1: menu per peran — maks 7 item utama, ikon via string key MENU_ICONS (bukan komponen langsung).
const MENUS: Record<string, { utama: MenuItem[]; lainnya: MenuItem[] }> = {
  SISWA: {
    utama: [
      { href: "/siswa", label: "Dasbor", icon: "dasbor" },
      { href: "/siswa/kelasku", label: "Kelasku", icon: "kelas" },
      { href: "/siswa/pengumuman", label: "Pengumuman", icon: "pengumuman" },
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
      { href: "/admin/siswa", label: "Siswa", icon: "siswa" },
      { href: "/admin/guru", label: "Guru", icon: "guru" },
      { href: "/admin/kelas", label: "Kelas", icon: "kelas" },
      { href: "/admin/jadwal", label: "Jadwal", icon: "jadwal" },
      { href: "/admin/kehadiran", label: "Kehadiran", icon: "kehadiran" },
      { href: "/admin/pengumuman", label: "Pengumuman", icon: "pengumuman" },
    ],
    lainnya: [
      { href: "/admin/inbox", label: "Pesan", icon: "inbox" },
      { href: "/admin/pengaturan", label: "Pengaturan", icon: "pengaturan" },
      { href: "/admin/audit", label: "Audit", icon: "audit" },
      { href: "/admin/wa", label: "WhatsApp", icon: "whatsapp" },
    ],
  },
};

export default async function DashLayout({ children }: { children: React.ReactNode }) {
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
