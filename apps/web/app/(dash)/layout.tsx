import { redirect } from "next/navigation";
import { getPageAuth } from "@/app/lib/require-page";
import DashShell, { type MenuItem } from "@/components/DashShell";
import {
  LayoutGrid, ClipboardList, FileText, Megaphone, MessageSquare, ShieldCheck,
  Trophy, QrCode, User, School, BarChart3, Check, Users,
} from "lucide-react";

// U1: menu per peran — maks 7 item utama, ikon EKSPLISIT (bukan substring).
const MENUS: Record<string, { utama: MenuItem[]; lainnya: MenuItem[] }> = {
  SISWA: {
    utama: [
      { href: "/siswa", label: "Dasbor", icon: LayoutGrid },
      { href: "/siswa/tugas", label: "Tugas", icon: ClipboardList },
      { href: "/siswa/asesmen", label: "Asesmen", icon: FileText },
      { href: "/siswa/pengumuman", label: "Pengumuman", icon: Megaphone },
      { href: "/siswa/inbox", label: "Pesan", icon: MessageSquare },
      { href: "/siswa/izin", label: "Izin", icon: ShieldCheck },
    ],
    lainnya: [
      { href: "/siswa/leaderboard", label: "Papan peringkat", icon: Trophy },
      { href: "/siswa/kartu", label: "Kartu saya", icon: QrCode },
      { href: "/siswa/profil", label: "Profil", icon: User },
    ],
  },
  GURU: {
    utama: [
      { href: "/guru", label: "Dasbor", icon: LayoutGrid },
      { href: "/guru/kelas-saya", label: "Kelas saya", icon: School },
      { href: "/guru/tugas", label: "Tugas", icon: ClipboardList },
      { href: "/guru/asesmen", label: "Asesmen", icon: FileText },
      { href: "/guru/kehadiran", label: "Kehadiran", icon: Check },
      { href: "/guru/inbox", label: "Pesan", icon: MessageSquare },
      { href: "/guru/rapor", label: "Rapor", icon: BarChart3 },
    ],
    lainnya: [
      { href: "/guru/izin", label: "Izin siswa", icon: ShieldCheck },
    ],
  },
  ADMIN: {
    utama: [
      { href: "/admin", label: "Dasbor", icon: LayoutGrid },
      { href: "/admin/siswa", label: "Siswa", icon: Users },
      { href: "/admin/guru", label: "Guru", icon: User },
      { href: "/admin/kelas", label: "Kelas", icon: School },
      { href: "/admin/kehadiran", label: "Kehadiran", icon: Check },
      { href: "/admin/pengumuman", label: "Pengumuman", icon: Megaphone },
      { href: "/admin/inbox", label: "Pesan", icon: MessageSquare },
    ],
    lainnya: [
      { href: "/admin/pengaturan", label: "Pengaturan", icon: LayoutGrid },
      { href: "/admin/audit", label: "Audit", icon: FileText },
      { href: "/admin/wa", label: "WhatsApp", icon: MessageSquare },
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
