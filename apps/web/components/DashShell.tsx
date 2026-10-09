"use client";

// Shell dasbor ala edukids: sidebar SVG icon (bukan emoji), promo card orb+spark SVG,
// topbar search pill, avatar aksen per peran, icon rotate on hover.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SchoolLogo from "./SchoolLogo";
import Bell from "./Bell";
import { LogoutButton } from "./LogoutButton";
import {
  IconGrid, IconUsers, IconUser, IconSchool, IconCalendar, IconClipboard,
  IconCheck, IconBarChart, IconBook, IconMessage, IconSettings, IconLock,
  IconSearch, IconWhatsapp, IconUpload, IconCamera, IconStar, IconActivity,
  IconBell,
} from "./Icons";

export type MenuItem = { href: string; label: string; badge?: number; icon?: React.ReactNode };

type IconFC = (p: { size?: number; color?: string }) => React.ReactElement;

const ICON_MAP: [string, IconFC][] = [
  ["dasbor",     IconGrid],
  ["dashboard",  IconGrid],
  ["kelas",      IconSchool],
  ["siswa",      IconUsers],
  ["guru",       IconUser],
  ["jadwal",     IconCalendar],
  ["tugas",      IconClipboard],
  ["penugasan",  IconClipboard],
  ["kehadiran",  IconCheck],
  ["absensi",    IconCheck],
  ["nilai",      IconStar],
  ["rapor",      IconBarChart],
  ["gradebook",  IconBarChart],
  ["materi",     IconBook],
  ["buku",       IconBook],
  ["pesan",      IconMessage],
  ["inbox",      IconMessage],
  ["notifikasi", IconBell],
  ["pengumuman", IconMessage],
  ["kalender",   IconCalendar],
  ["pengaturan", IconSettings],
  ["privasi",    IconLock],
  ["audit",      IconSearch],
  ["whatsapp",   IconWhatsapp],
  ["impor",      IconUpload],
  ["scanner",    IconCamera],
  ["profil",     IconUser],
  ["pantau",     IconActivity],
];

function resolveIcon(label: string): IconFC {
  const lc = label.toLowerCase();
  for (const [key, Icon] of ICON_MAP) {
    if (lc.includes(key)) return Icon;
  }
  return IconGrid;
}

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
  menus: { utama: MenuItem[]; lainnya: MenuItem[] };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const roleAccent: Record<string, string> = { ADMIN: "#e85e43", GURU: "#50643e", SISWA: "#4a8fa8" };
  const accent = roleAccent[role] ?? "#e85e43";

  const promoText: Record<string, string> = {
    SISWA: "Satu langkah kecil hari ini, satu dunia baru besok.",
    GURU:  "Belajar boleh serius. Serunya jangan hilang.",
    ADMIN: "Sekolah hebat butuh admin yang lebih hebat lagi.",
  };

  const nav = (items: MenuItem[]) =>
    items.map((m) => {
      const active = path === m.href || (m.href.length > 1 && path.startsWith(m.href));
      const Icon = resolveIcon(m.label);
      const iconColor = active ? accent : "#8a8a82";
      return (
        <Link
          key={m.href}
          href={m.href}
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 11px",
            borderRadius: 14,
            fontWeight: active ? 800 : 500,
            fontSize: 13,
            color: active ? "#171716" : "#74746d",
            background: active ? "#f0ede3" : "transparent",
            borderLeft: active ? `3px solid ${accent}` : "3px solid transparent",
            textDecoration: "none",
            transition: "background .18s, color .18s",
          }}
          className="side-link"
        >
          <span className="side-icon" style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 22, height: 22, transition: "transform .3s" }}>
            <Icon size={16} color={iconColor} />
          </span>
          <span style={{ flex: 1 }}>{m.label}</span>
          {typeof m.badge === "number" && m.badge > 0 && (
            <span style={{ background: accent, color: "#fffdf8", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "1px 7px", minWidth: 18, textAlign: "center" }}>
              {m.badge}
            </span>
          )}
        </Link>
      );
    });

  const sidebar = (
    <>
      <div style={{ padding: "2px 8px 18px" }}>
        <SchoolLogo name={schoolName} />
      </div>

      <p className="kicker" style={{ padding: "0 8px 4px" }}>Menu utama</p>
      {nav(menus.utama)}

      <p className="kicker" style={{ padding: "12px 8px 4px" }}>Lainnya</p>
      {nav(menus.lainnya)}

      {/* Promo card ala edukids: orb concentric + spark SVG */}
      <div style={{ marginTop: "auto", position: "relative", background: "#50643e", color: "#fffdf8", borderRadius: 20, padding: "18px 16px 16px", overflow: "hidden" }}>
        <span aria-hidden="true" style={{ position: "absolute", right: -35, top: -35, width: 120, height: 120, border: "1px solid rgba(255,255,255,.22)", borderRadius: "50%", boxShadow: "0 0 0 18px rgba(255,255,255,.05), 0 0 0 36px rgba(255,255,255,.025)", pointerEvents: "none" }} />
        <span aria-hidden="true" className="anim-drift" style={{ position: "absolute", right: 16, bottom: 14, opacity: 0.45, display: "grid", placeItems: "center" }}>
          <IconStar size={18} color="#f5c94a" />
        </span>
        <span style={{ display: "block", fontFamily: "var(--font-meta)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f5c94a", marginBottom: 10, position: "relative" }}>
          {role === "SISWA" ? "semangat belajar" : role === "GURU" ? "ruang guru" : "ruang admin"}
        </span>
        <p style={{ fontWeight: 800, margin: "0 0 6px", fontSize: 14, lineHeight: 1.15, position: "relative" }}>{schoolName}</p>
        <p style={{ margin: 0, opacity: 0.82, fontSize: 11, lineHeight: 1.55, position: "relative" }}>{promoText[role]}</p>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar Desktop (stasioner) */}
      <aside
        className="dash-sidebar-desktop"
        style={{
          width: 232,
          flexShrink: 0,
          background: "#fffdf8",
          borderRight: "1px solid rgba(23,23,22,.14)",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        {sidebar}
      </aside>

      {/* Drawer Mobile (Slide-over saat tombol burger diklik) */}
      {open && (
        <div
          className="dash-drawer-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23,23,22,.5)",
            backdropFilter: "blur(2px)",
            zIndex: 50,
          }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(84vw, 280px)",
              height: "100%",
              background: "#fffdf8",
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
              boxShadow: "4px 0 24px rgba(0,0,0,.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid rgba(23,23,22,.1)" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#8a8a82", textTransform: "uppercase", letterSpacing: "0.05em" }}>Menu Navigasi</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "#171716",
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
                aria-label="Tutup menu"
              >
                ✕
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px clamp(16px, 4vw, 40px)",
            borderBottom: "1px solid rgba(23,23,22,.14)",
            background: "#f7f4ec",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <button
            className="dash-burger btn-ghost btn-sticker"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
            style={{ padding: "8px 12px", display: "none", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 16 }}>☰</span>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Menu</span>
          </button>

          {/* Search pill */}
          <span
            className="dash-search-pill"
            style={{
              flex: 1,
              background: "#fffdf8",
              border: "1px solid rgba(23,23,22,.14)",
              borderRadius: 999,
              padding: "7px 16px",
              color: "#74746d",
              fontSize: 12,
              maxWidth: 380,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IconSchool size={14} color="#8a8a82" />
            {schoolName}
          </span>

          {/* Kanan: bell + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            <Bell />

            {/* Avatar chip */}
            <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, paddingLeft: 4, borderLeft: "1px solid rgba(23,23,22,.12)" }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: accent, color: "#fffdf8", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, border: "2px solid #fffdf8", boxShadow: `0 0 0 2px ${accent}`, flexShrink: 0 }}>
                {(userName || "?").slice(0, 1).toUpperCase()}
              </span>
              <span style={{ fontWeight: 700 }} className="dash-username">{userName}</span>
              <LogoutButton />
            </span>
          </div>
        </header>

        <main style={{ padding: "clamp(16px, 3vw, 36px) clamp(16px, 4vw, 40px) clamp(40px, 6vh, 60px)", maxWidth: 1200 }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dash-sidebar-desktop { display: none !important; }
          .dash-burger { display: inline-flex !important; }
          .dash-username { display: none; }
          .dash-search-pill { max-width: 200px !important; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
        @media (max-width: 480px) {
          .dash-search-pill { display: none !important; }
          .dash-burger span:last-child { display: none; }
          .dash-burger { padding: 8px 10px !important; }
        }
        .side-link:hover { background: #f0ede3 !important; color: #171716 !important; }
        .side-link:hover .side-icon { transform: rotate(12deg) scale(1.15); }
      `}</style>
    </div>
  );
}
