import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { requirePage } from "@/app/lib/require-page";
import DashShell, { type MenuItem } from "@/components/DashShell";

const MENUS: Record<string, { utama: MenuItem[]; lainnya: MenuItem[] }> = {
  SISWA: {
    utama: [
      { href: "/siswa", label: "Dasbor" },
      { href: "/siswa/tugas", label: "Tugas saya" },
      { href: "/siswa/asesmen", label: "Asesmen" },
      { href: "/siswa/izin", label: "Izin" },
      { href: "/siswa/inbox", label: "Pesan" },
    ],
    lainnya: [
      { href: "/siswa/leaderboard", label: "Papan peringkat" },
      { href: "/siswa/kartu", label: "Kartu saya" },
      { href: "/siswa/profil", label: "Profil" },
    ],
  },
  GURU: {
    utama: [
      { href: "/guru", label: "Dasbor" },
      { href: "/guru/kelas-saya", label: "Kelas saya" },
      { href: "/guru/tugas", label: "Tugas" },
      { href: "/guru/asesmen", label: "Asesmen" },
      { href: "/guru/kehadiran", label: "Kehadiran" },
      { href: "/guru/inbox", label: "Pesan" },
    ],
    lainnya: [
      { href: "/guru/scanner", label: "Pindai QR" },
      { href: "/guru/izin", label: "Izin siswa" },
      { href: "/guru/rapor", label: "Rapor" },
    ],
  },
  ADMIN: {
    utama: [
      { href: "/admin", label: "Dasbor" },
      { href: "/admin/kelas", label: "Kelas" },
      { href: "/admin/siswa", label: "Siswa" },
      { href: "/admin/guru", label: "Guru" },
      { href: "/admin/jadwal", label: "Jadwal" },
      { href: "/admin/notifikasi", label: "Notifikasi" },
      { href: "/admin/inbox", label: "Pesan" },
    ],
    lainnya: [
      { href: "/admin/kehadiran", label: "Kehadiran" },
      { href: "/admin/kalender", label: "Kalender" },
      { href: "/admin/penugasan", label: "Penugasan" },
      { href: "/admin/pengumuman", label: "Pengumuman" },
      { href: "/admin/pengaturan", label: "Pengaturan" },
      { href: "/admin/privasi", label: "Privasi" },
      { href: "/admin/audit", label: "Audit" },
      { href: "/admin/wa", label: "WhatsApp" },
      { href: "/admin/import", label: "Impor" },
    ],
  },
};

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const c = await cookies();
  const a = await requirePage({
    host: h.get("host") ?? "",
    token: c.get(SESSION_COOKIE)?.value,
    pathname: h.get("x-pathname") ?? "/",
  });
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
