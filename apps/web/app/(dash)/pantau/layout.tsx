import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@sms/shared/auth";
import { authorize } from "@/server/auth-gate";

// Root-admin: semua halaman di segmen ini dirender dinamis (sesi per request).
export const dynamic = "force-dynamic";

const TABS = [
  { href: "/pantau/dashboard", label: "Dasbor" },
  { href: "/pantau/users", label: "Pengguna" },
  { href: "/pantau/logs", label: "Log" },
  { href: "/pantau/files", label: "File" },
  { href: "/pantau/schools", label: "Sekolah" },
  { href: "/pantau/settings", label: "Pengaturan" },
];

export default async function PantauLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const path = h.get("x-pathname") ?? "/pantau";
  const a = await authorize({
    host: h.get("host") ?? "",
    token: (await cookies()).get(SESSION_COOKIE)?.value,
    pathname: path,
  });
  if (!a.ok) redirect(a.error === "must-change-password" ? "/change-password" : "/admin");
  if (a.role !== "SUPER_ADMIN") redirect("/admin");
  if (a.mustChangePassword) redirect("/change-password");

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-paper)" }}>
      <header style={{ background: "var(--color-cream)", borderBottom: "1px solid var(--color-line)" }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <Link href="/pantau/dashboard" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="kicker" style={{ display: "block" }}>Root admin</span>
            <span className="display" style={{ fontSize: 20 }}>SMS-LMS · Pantau</span>
          </Link>
          <nav aria-label="Navigasi root" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {TABS.map((t) => {
              const active = path === t.href || path.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                    color: active ? "var(--color-terracotta-deep)" : "var(--color-muted)",
                    background: active ? "var(--color-paper-deep)" : "transparent",
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 20px 64px" }}>{children}</main>
    </div>
  );
}
