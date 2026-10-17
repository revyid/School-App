"use client";

// Shell dasbor — F1 (satu pustaka ikon: lucide, eksplisit per menu),
// U2 (tanpa search pill palsu, tanpa kartu promo, nama sekolah 1×),
// drawer mobile pakai shadcn Sheet (focus trap + Esc + scroll lock).
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SchoolLogo from "./SchoolLogo";
import Bell from "./Bell";
import { LogoutButton } from "./LogoutButton";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, Users, User, School, Calendar, ClipboardList, Check,
  BarChart3, BookOpen, MessageSquare, Bell as BellIcon, Settings, Lock,
  MessageCircle, Upload, Camera, Star, MapPin, Activity, FileText,
  ShieldCheck, Megaphone, type LucideIcon,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MenuItem = {
  href: string;
  label: string;
  badge?: number;
  icon?: keyof typeof MENU_ICONS;
};

export const MENU_ICONS = {
  dasbor: LayoutGrid,
  kelas: School,
  siswa: Users,
  jadwal: Calendar,
  tugas: ClipboardList,
  kehadiran: Check,
  nilai: Star,
  rapor: BarChart3,
  materi: BookOpen,
  pesan: MessageSquare,
  inbox: MessageSquare,
  notifikasi: BellIcon,
  pengumuman: Megaphone,
  pengaturan: Settings,
  privasi: Lock,
  audit: FileText,
  whatsapp: MessageCircle,
  impor: Upload,
  scanner: Camera,
  profil: User,
  pantau: Activity,
  peta: MapPin,
  asesmen: FileText,
  izin: ShieldCheck,
} as const;

// Aksen per role. Nilai var() hanya dipakai di properti CSS (background/border),
// bukan di atribut SVG.
const ROLE_ACCENT: Record<string, string> = {
  ADMIN: "var(--color-terracotta-dark)",
  GURU: "var(--color-olive-deep)",
  SISWA: "var(--color-teal)",
};
const ROLE_ACCENT_CLASS: Record<string, string> = {
  ADMIN: "text-terracotta-dark",
  GURU: "text-olive-deep",
  SISWA: "text-teal",
};

export default function DashShell({
  role,
  userName,
  schoolName,
  menus,
  children,
}: {
  role: "ADMIN" | "GURU" | "SISWA";
  userName: string;
  schoolName: string;
  menus: { utama: MenuItem[]; lainnya: MenuItem[]; groups?: { label: string; items: MenuItem[] }[] };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const accent = ROLE_ACCENT[role] ?? "var(--color-terracotta-dark)";
  const accentClass = ROLE_ACCENT_CLASS[role] ?? "text-terracotta-dark";

  const nav = (items: MenuItem[]) =>
    items.map((m) => {
      const active = path === m.href || (m.href.length > 1 && path.startsWith(m.href + "/"));
      const Icon = (m.icon ? MENU_ICONS[m.icon] : null) ?? LayoutGrid;
      return (
        <Link
          key={m.href}
          href={m.href}
          onClick={() => setOpen(false)}
          className={cn(
            "side-link flex items-center gap-2.5 rounded-2xl border-l-[3px] py-2 pr-3 pl-2.5 text-[13px] font-medium no-underline transition-colors",
            active
              ? "border-l-[3px] bg-paper font-extrabold text-ink"
              : "border-l-[3px] border-transparent text-muted-strong hover:bg-paper hover:text-ink",
          )}
          // dynamic: warna aksen role
          style={active ? { borderLeftColor: accent } : undefined}
          aria-current={active ? "page" : undefined}
        >
          <Icon size={16} className={cn("shrink-0", active ? accentClass : "text-muted-strong")} aria-hidden="true" />
          <span className="flex-1">{m.label}</span>
          {typeof m.badge === "number" && m.badge > 0 && (
            // dynamic: warna aksen role
            <span className="grid min-w-[18px] place-items-center rounded-full px-1.5 text-center text-[10px] font-extrabold text-cream" style={{ background: accent }}>
              {m.badge > 99 ? "99+" : m.badge}
            </span>
          )}
        </Link>
      );
    });

  const sidebar = (
    <>
      <div className="px-2 pb-4 pt-0.5">
        <SchoolLogo name={schoolName} />
      </div>
      <p className="kicker px-2 pb-1">Menu utama</p>
      {nav(menus.utama)}
      {menus.groups?.map((g) => (
        <div key={g.label}>
          <p className="kicker mt-3 px-2 pb-1">{g.label}</p>
          {nav(g.items)}
        </div>
      ))}
      {!menus.groups && (
        <>
          <p className="kicker mt-3 px-2 pb-1">Lainnya</p>
          {nav(menus.lainnya)}
        </>
      )}
    </>
  );

  const roleLabel = role === "ADMIN" ? "Admin" : role === "GURU" ? "Guru" : "Siswa";
  const profileHref = role === "SISWA" ? "/siswa/profil" : null;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="dash-sidebar-desktop sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-cream px-3.5 py-5 md:flex">
        {sidebar}
      </aside>

      {/* Drawer mobile — shadcn Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="gap-1 overflow-y-auto p-0">
          <SheetHeader className="border-b border-line">
            <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
            <SheetDescription className="sr-only">Pilih halaman yang ingin dibuka.</SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar — U2: tanpa search pill; nama sekolah hanya di logo sidebar. */}
        <header
          aria-label="Navigasi utama"
          className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper px-[clamp(16px,4vw,40px)] py-3"
        >
          {/* Burger mobile */}
          <button
            type="button"
            className="dash-burger btn-ghost btn-sticker cursor-pointer md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" />
            </svg>
            <span className="text-xs font-bold">Menu</span>
          </button>

          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-1.5 focus:text-xs focus:text-cream">
            Lewati ke konten
          </a>

          <div className="ml-auto flex items-center gap-2.5">
            <Bell />

            {/* Avatar chip + dropdown profil (Profil · Ganti sandi · Keluar) */}
            <div className="relative">
              <DropdownMenu key={path}>
                <DropdownMenuTrigger
                  aria-label="Menu profil"
                  className="flex min-h-0 gap-2 rounded-none border-0 border-l border-line bg-transparent py-1 pl-3 text-[13px] font-normal hover:bg-transparent [&_svg]:size-2.5"
                >
                  <span className="dash-username max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap font-bold">{userName}</span>
                  {/* dynamic: warna aksen role + ring */}
                  <span
                    className="grid size-[34px] shrink-0 place-items-center rounded-full border-2 border-cream font-extrabold text-cream"
                    style={{ background: accent, boxShadow: `0 0 0 2px ${accent}` }}
                  >
                    {(userName || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="min-w-[240px] rounded-3xl p-3.5">
                  <div className="flex items-center gap-2.5 px-1 py-1">
                    {/* dynamic: warna aksen role */}
                    <span className="grid size-10 shrink-0 place-items-center rounded-full font-extrabold text-cream" style={{ background: accent }}>
                      {(userName || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-ink">{userName}</div>
                      <div className="text-[11px] font-bold tracking-wider text-muted-strong uppercase">{roleLabel}</div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {profileHref && (
                    <DropdownMenuItem render={<Link href={profileHref} />}>
                      Profil
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem render={<Link href="/change-password" />}>
                    Ganti kata sandi
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-1 py-1">
                    <LogoutButton />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main id="main-content" className="max-w-[1200px] px-[clamp(16px,4vw,40px)] pt-[clamp(16px,3vw,36px)] pb-[clamp(40px,6vh,60px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
