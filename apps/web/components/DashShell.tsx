"use client";

// Shell dasbor playful ala edukids: sidebar dengan emoji, promo card berbuih,
// mascot spark di topbar, streak dots, icon hover rotate.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SchoolLogo from "./SchoolLogo";
import Bell from "./Bell";
import { LogoutButton } from "./LogoutButton";

export type MenuItem = { href: string; label: string; badge?: number; icon?: string };

// Emoji default per label — sidebar tidak butuh prop tambahan dari luar.
const ICON_MAP: Record<string, string> = {
  Dasbor: "◎", Dashboard: "◎",
  Kelas: "🏫", Siswa: "🧑‍🎓", Guru: "👩‍🏫",
  Jadwal: "📅", Tugas: "📝", Penugasan: "📝",
  Kehadiran: "✅", Absensi: "✅",
  Nilai: "🏅", Rapor: "📊", Gradebook: "📊",
  Materi: "📚", "E-Buku": "📖", Buku: "📖",
  Pesan: "💬", Inbox: "💬", Pengumuman: "📣",
  Kalender: "📆", Acara: "🎉",
  Pengaturan: "⚙️", Setting: "⚙️",
  Privasi: "🔒", Audit: "🔍",
  WhatsApp: "💚", Impor: "📥",
  Scanner: "📷", "Scan QR": "📷",
  Profil: "👤", Akun: "👤",
};

function menuIcon(label: string): string {
  for (const [k, v] of Object.entries(ICON_MAP)) {
    if (label.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "✦";
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

  const roleColor: Record<string, string> = { ADMIN: "#e85e43", GURU: "#50643e", SISWA: "#4a8fa8" };
  const accent = roleColor[role] ?? "#e85e43";

  const promoText: Record<string, string> = {
    SISWA: "Satu langkah kecil hari ini, satu dunia baru besok. ✨",
    GURU: "Belajar boleh serius. Serunya jangan hilang. 🌿",
    ADMIN: "Sekolah hebat butuh admin yang lebih hebat lagi. 💪",
  };

  const nav = (items: MenuItem[]) =>
    items.map((m) => {
      const active = path === m.href || (m.href !== "/dasbor" && path.startsWith(m.href));
      const icon = m.icon ?? menuIcon(m.label);
      return (
        <Link
          key={m.href}
          href={m.href}
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 11px",
            borderRadius: 14,
            fontWeight: active ? 800 : 500,
            fontSize: 13,
            color: active ? "#171716" : "#74746d",
            background: active ? "#f0ede3" : "transparent",
            borderLeft: active ? `3px solid ${accent}` : "3px solid transparent",
            textDecoration: "none",
            transition: "background .2s, color .2s",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 22,
              height: 22,
              fontSize: 15,
              lineHeight: 1,
              color: active ? accent : "#8a8a82",
              flexShrink: 0,
              transition: "transform .3s",
            }}
            className="side-icon-emoji"
          >
            {icon}
          </span>
          <span style={{ flex: 1 }}>{m.label}</span>
          {typeof m.badge === "number" && m.badge > 0 && (
            <span
              style={{
                background: accent,
                color: "#fffdf8",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                padding: "1px 7px",
                minWidth: 18,
                textAlign: "center",
              }}
            >
              {m.badge}
            </span>
          )}
        </Link>
      );
    });

  const sidebar = (
    <>
      {/* Brand */}
      <div style={{ padding: "2px 8px 18px" }}>
        <SchoolLogo />
      </div>

      {/* Menu utama */}
      <p className="kicker" style={{ padding: "0 8px 4px" }}>Menu utama</p>
      {nav(menus.utama)}

      {/* Lainnya */}
      <p className="kicker" style={{ padding: "12px 8px 4px" }}>Lainnya</p>
      {nav(menus.lainnya)}

      {/* Promo card bergaya edukids: orb, spark */}
      <div
        style={{
          marginTop: "auto",
          position: "relative",
          background: "#50643e",
          color: "#fffdf8",
          borderRadius: 20,
          padding: "18px 16px 16px",
          overflow: "hidden",
        }}
      >
        {/* Orb dekoratif */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -35,
            top: -35,
            width: 120,
            height: 120,
            border: "1px solid rgba(255,255,255,.25)",
            borderRadius: "50%",
            boxShadow: "0 0 0 16px rgba(255,255,255,.06), 0 0 0 32px rgba(255,255,255,.03)",
          }}
        />
        {/* Spark drift */}
        <span
          aria-hidden="true"
          className="anim-drift"
          style={{ position: "absolute", right: 14, bottom: 14, fontSize: 22, opacity: 0.55 }}
        >✦</span>
        <span
          aria-hidden="true"
          style={{
            display: "block",
            fontFamily: "var(--font-meta)",
            fontSize: 9,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#f5c94a",
            marginBottom: 10,
            position: "relative",
          }}
        >
          {role === "SISWA" ? "semangat belajar" : role === "GURU" ? "ruang guru" : "ruang admin"}
        </span>
        <p style={{ fontWeight: 800, margin: "0 0 6px", fontSize: 14, lineHeight: 1.15, position: "relative" }}>
          {schoolName}
        </p>
        <p style={{ margin: 0, opacity: 0.82, fontSize: 11, lineHeight: 1.55, position: "relative" }}>
          {promoText[role]}
        </p>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar desktop */}
      <aside
        className="dash-sidebar"
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

      {/* Drawer HP */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(23,23,22,.4)", zIndex: 40 }}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 264,
              height: "100%",
              background: "#fffdf8",
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              overflowY: "auto",
            }}
          >
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
            style={{ padding: "8px 12px", display: "none" }}
          >
            ☰
          </button>

          {/* Search pill dengan sekolah */}
          <span
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
            <span style={{ fontSize: 16 }}>🏫</span>
            {schoolName}
          </span>

          {/* Spark decoratif topbar */}
          <span
            aria-hidden="true"
            className="anim-drift"
            style={{ fontSize: 18, color: accent, opacity: 0.7, flexShrink: 0 }}
          >✦</span>

          <Bell />

          {/* Avatar + nama */}
          <span style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: accent,
                color: "#fffdf8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                border: "2px solid #fffdf8",
                boxShadow: `0 0 0 2px ${accent}`,
              }}
            >
              {(userName || "?").slice(0, 1).toUpperCase()}
            </span>
            <span style={{ fontWeight: 700 }} className="dash-username">{userName}</span>
            <LogoutButton />
          </span>
        </header>

        <main style={{ padding: "clamp(16px, 3vw, 36px) clamp(16px, 4vw, 40px) 64px", maxWidth: 1200 }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .dash-sidebar { display: none; }
          .dash-burger { display: inline-flex !important; }
          .dash-username { display: none; }
        }
        .side-icon-emoji { transition: transform .3s; }
        a:hover .side-icon-emoji { transform: rotate(15deg) scale(1.18); }
      `}</style>
    </div>
  );
}
