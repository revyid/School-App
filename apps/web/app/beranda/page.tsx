// Landing platform. Disajikan HANYA di apex (proxy me-rewrite "/" -> "/beranda");
// "/" milik tiap sekolah tetap (portal)/page.tsx.
import {
  CalendarCheck,
  ClipboardList,
  UserX,
  MessageCircle,
  BellRing,
  MapPin,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import SchoolsClient from "./SchoolsClient";
import { getRootSettings } from "@/lib/public-cache";

const FEATURES = [
  { icon: CalendarCheck, title: "Presensi & Absensi", desc: "Catat kehadiran siswa secara digital, rekap otomatis tiap bulan." },
  { icon: ClipboardList, title: "Tugas & Asesmen", desc: "Distribusi tugas, kuis, dan penilaian dalam satu alur." },
  { icon: UserX, title: "Izin & Tidak Hadir", desc: "Pengajuan izin orang tua langsung ke wali kelas." },
  { icon: MessageCircle, title: "Chat AI", desc: "Asisten belajar berbasis AI untuk siswa dan guru." },
  { icon: BellRing, title: "Notifikasi WA", desc: "Kabar penting dikirim otomatis via WhatsApp." },
  { icon: MapPin, title: "Peta & Buku Digital", desc: "Lokasi sekolah dan katalog buku digital terpadu." },
  { icon: ShieldCheck, title: "Pantau Akun & Log", desc: "Audit aktivitas akun untuk keamanan data sekolah." },
  { icon: BarChart3, title: "Lapangan Analitik", desc: "Dashboard analitik kehadiran, nilai, dan tren sekolah." },
] as const;

const ROLES = [
  { label: "Para Orang Tua", desc: "Pantau kehadiran, tugas, dan perkembangan anak secara real-time tanpa perlu datang ke sekolah." },
  { label: "Wali Kelas", desc: "Kelola absensi, distribusi tugas, dan komunikasi dengan orang tua dari satu dasbor." },
  { label: "Kepala Sekolah", desc: "Lihat analitik seluruh kelas, pantau kinerja guru, dan ambil keputusan berbasis data." },
] as const;

export default async function LandingPage() {
  // Setelan platform (nama, tagline, logo, hero) dari RootSettings.
  // Invalidasi: PATCH /api/root/settings -> revalidateTag("root-settings").
  const cfg = await getRootSettings().catch(() => null);
  const platformName = cfg?.settings?.platformName || "Lacakedu";
  const platformTagline = cfg?.settings?.platformTagline || "Kelola kehadiran, tugas, asesmen, dan komunikasi sekolah secara terpadu.";
  const heroUrl = cfg?.heroImageUrl || "";
  const logoUrl = cfg?.platformLogoUrl || "";
  // heroUrl sudah berupa path endpoint hero ("/api/root/settings/hero?f=...") -> pakai langsung
  // + cache-buster. Logo platform disimpan sebagai path file -> lewat route penyaji.
  const heroSrc = heroUrl
    ? heroUrl.startsWith("http")
      ? heroUrl
      : `${heroUrl}${heroUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
    : "";

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      <main style={{ maxWidth: 1600, margin: "0 auto", background: "#f7f4ec", overflow: "clip" }}>

        {/* NAVBAR */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px clamp(16px, 4vw, 112px)",
            minHeight: 72,
            position: "sticky",
            top: 0,
            zIndex: 40,
            background: "rgba(247, 244, 236, 0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(23,23,22,.14)",
          }}
        >
          <span className="display" style={{ fontSize: 20, letterSpacing: "-0.04em", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/portal/platform-logo?v=${Date.now()}`} alt={platformName} width={26} height={26} style={{ borderRadius: 7 }} />
            ) : null}
            {platformName}
          </span>
          <nav style={{ display: "flex", gap: "clamp(18px, 3vw, 44px)", marginLeft: "auto", fontSize: 12, fontWeight: 600 }}>
            <a href="#fitur" style={{ color: "#575752", textDecoration: "none" }}>Fitur</a>
            <a href="#sekolah" style={{ color: "#575752", textDecoration: "none" }}>Sekolah</a>
            <a href="#cara-pakai" style={{ color: "#575752", textDecoration: "none" }}>Cara Pakai</a>
          </nav>
          <a
            href="/admin"
            className="btn-sticker btn-primary"
            style={{ textDecoration: "none", minHeight: 40, padding: "8px 16px", fontSize: 12 }}
          >
            Buka Dashboard
          </a>
        </header>

        {/* HERO */}
        <section style={{ padding: "80px clamp(16px, 5vw, 112px) 60px", textAlign: "center" }}>
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroSrc}
              alt={`${platformName} — hero platform`}
              style={{ width: "100%", maxHeight: 380, objectFit: "cover", borderRadius: 20, marginBottom: 34 }}
            />
          ) : null}
          <Reveal>
            <p className="kicker" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              Learning Management System untuk sekolah
            </p>
            <h1 className="display" style={{ fontSize: "clamp(44px, 5.4vw, 84px)", margin: "0 auto 21px", maxWidth: 740, lineHeight: 1.02 }}>
              Satu platform untuk semua<br /><span style={{ color: "#e85e43" }}>sekolah</span>
            </h1>
            <p style={{ maxWidth: 480, margin: "0 auto", color: "#575752", fontSize: 15, lineHeight: 1.75 }}>
              {platformTagline} Dibangun untuk guru, siswa, dan orang tua.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 36, flexWrap: "wrap" }}>
              <a
                href="/admin"
                className="btn-sticker btn-primary"
                style={{ textDecoration: "none", minHeight: 50, padding: "0 24px" }}
              >
                Buka Dashboard
              </a>
              <a
                href="#sekolah"
                className="btn-sticker btn-ghost"
                style={{ textDecoration: "none", minHeight: 50, padding: "0 24px" }}
              >
                Lihat Sekolah
              </a>
            </div>
          </Reveal>
        </section>

        {/* FITUR */}
        <section id="fitur" style={{ padding: "80px clamp(16px, 5vw, 112px)", background: "#fffdf8" }}>
          <Reveal>
            <p className="kicker" style={{ marginBottom: 12 }}>Fitur Platform</p>
            <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 56px)", marginBottom: 48 }}>
              Semua yang sekolah butuhkan,<br /><span style={{ color: "#e85e43" }}>dalam satu tempat.</span>
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <article className="card card-lift" style={{ padding: 28, height: "100%" }}>
                  <div style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: 14, background: "#dcead0", marginBottom: 18, color: "#50643e" }}>
                    <f.icon size={24} strokeWidth={2} />
                  </div>
                  <h3 className="display" style={{ fontSize: 18, marginBottom: 8 }}>{f.title}</h3>
                  <p style={{ color: "#575752", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* SEKOLAH */}
        <section id="sekolah" style={{ padding: "80px clamp(16px, 5vw, 112px)" }}>
          <Reveal>
            <p className="kicker" style={{ marginBottom: 12 }}>Sekolah Terdaftar</p>
            <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 56px)", marginBottom: 12 }}>
              Bergabung bersama <span style={{ color: "#e85e43" }}>sekolah lain.</span>
            </h2>
            <p style={{ color: "#575752", fontSize: 14, marginBottom: 36, maxWidth: 480 }}>
              Setiap sekolah memiliki portal publik sendiri. Pilih sekolah untuk melihat pengumuman dan informasi mereka.
            </p>
          </Reveal>
          <SchoolsClient />
        </section>

        {/* CARA PAKAI / TESTIMONIALS */}
        <section id="cara-pakai" style={{ padding: "80px clamp(16px, 5vw, 112px)", background: "#fffdf8" }}>
          <Reveal>
            <p className="kicker" style={{ marginBottom: 12 }}>Cara Pakai</p>
            <h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 56px)", marginBottom: 48 }}>
              Dirancang untuk <span style={{ color: "#e85e43" }}>semua peran.</span>
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {ROLES.map((r, i) => (
              <Reveal key={r.label} delay={i * 100}>
                <article
                  className="card-lift"
                  style={{
                    position: "relative",
                    minHeight: 240,
                    padding: 28,
                    borderRadius: 34,
                    overflow: "hidden",
                    background: ["#f5c94a", "#dcead0", "#97c4db"][i % 3],
                    transform: `rotate(${(i % 2 === 0 ? -0.8 : 0.8)}deg)`,
                  }}
                >
                  <p className="kicker" style={{ opacity: 0.7, marginBottom: 16 }}>{r.label}</p>
                  <p style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 300, margin: 0, color: "#171716" }}>{r.desc}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA FOOTER */}
        <footer style={{ padding: "80px clamp(24px, 7vw, 112px) 25px", color: "#fffdf8", background: "#171716" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 50, flexWrap: "wrap", paddingBottom: 60 }}>
            <div>
              <span className="display" style={{ fontSize: 22, letterSpacing: "-0.04em" }}>Lacakedu</span>
              <p style={{ marginTop: 16, color: "rgba(255,253,248,.62)", fontSize: 14, lineHeight: 1.6, maxWidth: 320 }}>
                Platform manajemen sekolah terpadu. Menghubungkan guru, siswa, dan orang tua dalam satu ekosistem digital.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(100px, 1fr))", gap: "clamp(24px, 5vw, 80px)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <span style={{ marginBottom: 10, color: "#f5c94a", fontFamily: "var(--font-meta)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" as const }}>Platform</span>
                <a href="#fitur" style={{ color: "rgba(255,253,248,.7)", fontSize: 12, textDecoration: "none" }}>Fitur</a>
                <a href="#sekolah" style={{ color: "rgba(255,253,248,.7)", fontSize: 12, textDecoration: "none" }}>Sekolah</a>
                <a href="/admin" style={{ color: "rgba(255,253,248,.7)", fontSize: 12, textDecoration: "none" }}>Dashboard</a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <span style={{ marginBottom: 10, color: "#f5c94a", fontFamily: "var(--font-meta)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" as const }}>Legal</span>
                <a href="/privasi" style={{ color: "rgba(255,253,248,.7)", fontSize: 12, textDecoration: "none" }}>Hak Akses Pribadi</a>
                <a href="/syarat" style={{ color: "rgba(255,253,248,.7)", fontSize: 12, textDecoration: "none" }}>Syarat Layanan</a>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <span style={{ marginBottom: 10, color: "#f5c94a", fontFamily: "var(--font-meta)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" as const }}>Kontak</span>
                <span style={{ color: "rgba(255,253,248,.7)", fontSize: 12 }}>info@lacakedu.web.id</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, paddingTop: 19, borderTop: "1px solid rgba(255,255,255,.15)", color: "rgba(255,253,248,.6)", fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase" as const }}>
            <span>Lacakedu &copy; {new Date().getFullYear()}</span>
            <span>Dibangun untuk sekolah</span>
          </div>
        </footer>
      </main>

      <style>{`section[id] { scroll-margin-top: 96px; }
      @media (max-width: 680px) {
        #fitur > div, #cara-pakai > div { grid-template-columns: 1fr !important; }
      }`}</style>
    </div>
  );
}
