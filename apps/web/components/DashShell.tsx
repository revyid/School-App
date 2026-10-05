"use client";

// Shell dasbor ala referensi: sidebar kiri (drawer di HP) + topbar + konten.
// Menu disesuaikan peran; semua link = route nyata (tanpa dead nav).
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SchoolLogo from "./SchoolLogo";
import Bell from "./Bell";
import { LogoutButton } from "./LogoutButton";

export type MenuItem = { href: string; label: string; badge?: number };

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

  const nav = (items: MenuItem[]) =>
    items.map((m) => {
      const active = path === m.href;
      return (
        <Link
          key={m.href}
          href={m.href}
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 14,
            fontWeight: active ? 800 : 500,
            fontSize: 13.5,
            color: active ? "#171716" : "#74746d",
            background: active ? "#eeeadd" : "transparent",
            borderLeft: active ? "3px solid #e85e43" : "3px solid transparent",
            textDecoration: "none",
          }}
        >
          <span style={{ flex: 1 }}>{m.label}</span>
          {typeof m.badge === "number" && m.badge > 0 && (
            <span
              style={{
                background: "#e85e43",
                color: "#fffdf8",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                padding: "1px 8px",
              }}
            >
              {m.badge}
            </span>
          )}
        </Link>
      );
    });

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
          gap: 6,
          position: "sticky",
          top: 0,
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "2px 8px 14px" }}>
          <SchoolLogo />
        </div>
        <p className="kicker" style={{ padding: "0 8px 4px" }}>Menu utama</p>
        {nav(menus.utama)}
        <p className="kicker" style={{ padding: "12px 8px 4px" }}>Lainnya</p>
        {nav(menus.lainnya)}
        <div
          style={{
            marginTop: "auto",
            background: "#50643e",
            color: "#fffdf8",
            borderRadius: 20,
            padding: "14px",
            fontSize: 12.5,
          }}
        >
          <p style={{ fontWeight: 800, margin: 0 }}>{schoolName}</p>
          <p style={{ margin: "4px 0 0", opacity: 0.85 }}>
            {role === "SISWA" ? "Satu langkah kecil hari ini, satu dunia baru besok." : "Belajar boleh serius. Serunya jangan hilang."}
          </p>
        </div>
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
              width: 260,
              height: "100%",
              background: "#fffdf8",
              padding: "20px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowY: "auto",
            }}
          >
            <div style={{ padding: "2px 8px 14px" }}>
              <SchoolLogo />
            </div>
            <p className="kicker" style={{ padding: "0 8px 4px" }}>Menu utama</p>
            {nav(menus.utama)}
            <p className="kicker" style={{ padding: "12px 8px 4px" }}>Lainnya</p>
            {nav(menus.lainnya)}
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
            padding: "14px clamp(16px, 4vw, 40px)",
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
          <span
            style={{
              flex: 1,
              background: "#fffdf8",
              border: "1px solid rgba(23,23,22,.14)",
              borderRadius: 999,
              padding: "8px 16px",
              color: "#74746d",
              fontSize: 13,
              maxWidth: 420,
            }}
          >
            {schoolName}
          </span>
          <Bell />
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#e85e43",
                color: "#fffdf8",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
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

      <style>{`@media (max-width: 860px) {
        .dash-sidebar { display: none; }
        .dash-burger { display: inline-flex !important; }
        .dash-username { display: none; }
      }`}</style>
    </div>
  );
}
