"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";

const Map = dynamic(() => import("./Map"), { ssr: false });
const BookSearch = dynamic(() => import("./BookSearch"), { ssr: false });

// Portal publik per sekolah (tanpa login): hero editorial + pengumuman + peta +
// katalog buku + CTA Ruang GTK/Murid. Data non-sensitif saja.
export default function PortalPage() {
  const info = useFetch<{
    school: { name: string; lat: number | null; lng: number | null };
    portalName: string;
    ctaGtkUrl: string | null;
    ctaMuridUrl: string | null;
    announcements: { id: string; title: string; body: string; publishAt: string }[];
  }>("/api/portal/info");

  const nama = info.data?.school.name ?? "Sekolah";
  const ann = info.data?.announcements ?? [];

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh" }}>
      {/* NAVBAR */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px clamp(20px, 6vw, 88px)",
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "#f7f4ec",
          borderBottom: "1px solid rgba(23,23,22,.14)",
        }}
      >
        <Logo />
        <nav style={{ display: "flex", gap: 20, margin: "0 auto", fontSize: 13.5 }} className="portal-nav">
          <a href="#pengumuman" style={{ color: "#74746d", textDecoration: "none" }}>Pengumuman</a>
          <a href="#bacaan" style={{ color: "#74746d", textDecoration: "none" }}>Bacaan</a>
          <a href="#lokasi" style={{ color: "#74746d", textDecoration: "none" }}>Lokasi</a>
        </nav>
        <a href="/login" className="btn-sticker" style={{ background: "#171716", color: "#fffdf8", textDecoration: "none" }}>
          Masuk ↗
        </a>
      </header>

      {/* HERO */}
      <section
        style={{
          textAlign: "center",
          padding: "clamp(32px, 5vw, 72px) clamp(20px, 6vw, 88px) clamp(28px, 4vw, 48px)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: "16%", left: "12%", zIndex: 0 }} className="anim-drift" aria-hidden="true">
          <svg width="110" height="56" viewBox="0 0 110 56" fill="none">
            <ellipse cx="55" cy="28" rx="48" ry="22" stroke="#e85e43" strokeWidth="2" strokeDasharray="8 7" transform="rotate(-14 55 28)" />
            <ellipse cx="55" cy="28" rx="38" ry="16" stroke="#171716" strokeWidth="1.5" strokeDasharray="5 6" transform="rotate(-14 55 28)" />
          </svg>
        </div>
        <div style={{ position: "absolute", top: "12%", right: "14%", zIndex: 0 }} className="anim-drift" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <path d="M22 4v36M4 22h36M9.5 9.5l25 25M34.5 9.5l-25 25" stroke="#e85e43" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <Reveal>
          <p className="kicker">● Ruang tumbuh {nama}</p>
          <h1 className="display" style={{ fontSize: "clamp(44px, 8vw, 110px)", margin: "14px 0" }}>
            Belajar<br />seru, <span style={{ color: "#e85e43" }}>mimpi</span><br />melaju.
          </h1>
          <p style={{ color: "#74746d", maxWidth: 480, margin: "0 auto 22px" }}>
            {info.data?.portalName ?? "Portal informasi sekolah"} — pengumuman, bacaan, dan lokasi dalam satu halaman.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/login" className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>Mulai belajar ↗</a>
            <a href="#pengumuman" className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>Lihat pengumuman</a>
          </div>
        </Reveal>
      </section>

      <main style={{ padding: "0 clamp(20px, 6vw, 88px) 72px", display: "grid", gap: 22, maxWidth: 1200, margin: "0 auto" }}>
        {/* PENGUMUMAN */}
        <section id="pengumuman">
          <Reveal>
            <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)" }}>
              <p className="kicker">Papan informasi</p>
              <h2 className="display" style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: "6px 0 16px" }}>Pengumuman</h2>
              {!info.data ? (
                <p style={{ color: "#74746d" }}>Memuat…</p>
              ) : ann.length === 0 ? (
                <p style={{ color: "#74746d" }}>Belum ada pengumuman terbaru. Silakan kembali lagi nanti.</p>
              ) : (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {ann.slice(0, 4).map((p, i) => (
                    <article
                      key={p.id}
                      className="card card-lift"
                      style={{
                        padding: 18,
                        background: ["#fffdf8", "#f5c94a", "#97c4db", "#aec6a4"][i % 4],
                        transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 0.8}deg)`,
                      }}
                    >
                      <p style={{ fontSize: 11, color: "#74746d", margin: 0 }}>
                        {new Date(p.publishAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: "6px 0", letterSpacing: "-0.01em" }}>{p.title}</h3>
                      <p style={{ fontSize: 13, color: "#3d3d38", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.body}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        </section>

        {/* BACAAN */}
        <section id="bacaan">
          <Reveal>
            <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)", background: "#50643e", color: "#fffdf8", borderColor: "#50643e" }}>
              <p className="kicker" style={{ color: "#f5c94a" }}>Rak bacaan</p>
              <h2 className="display" style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: "6px 0 16px" }}>Jelajahi buku</h2>
              <BookSearch />
            </div>
          </Reveal>
        </section>

        {/* LOKASI + CTA */}
        <section id="lokasi" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 22 }} className="portal-bottom">
          <Reveal>
            <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)" }}>
              <p className="kicker">Temukan kami</p>
              <h2 className="display" style={{ fontSize: "clamp(24px, 3vw, 34px)", margin: "6px 0 16px" }}>Lokasi sekolah</h2>
              {info.data && info.data.school.lat != null && info.data.school.lng != null ? (
                <Map lat={info.data.school.lat} lng={info.data.school.lng} />
              ) : (
                <p style={{ color: "#74746d" }}>Peta belum diatur oleh admin sekolah.</p>
              )}
              {(info.data?.ctaGtkUrl || info.data?.ctaMuridUrl) && (
                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  {info.data.ctaGtkUrl && (
                    <a href={info.data.ctaGtkUrl} target="_blank" rel="noreferrer" className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>
                      Ruang GTK ↗
                    </a>
                  )}
                  {info.data.ctaMuridUrl && (
                    <a href={info.data.ctaMuridUrl} target="_blank" rel="noreferrer" className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>
                      Ruang Murid ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div
              className="card"
              style={{
                padding: "clamp(20px, 3vw, 32px)",
                background: "#f5c94a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                textAlign: "center",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Image src="/assets/char-girl.png" alt="" width={170} height={200} className="anim-floaty" style={{ objectFit: "contain" }} />
              <h2 className="display" style={{ fontSize: 26, margin: 0 }}>Siap menemukan hal baru?</h2>
              <a href="/login" className="btn-sticker" style={{ background: "#171716", color: "#fffdf8", textDecoration: "none" }}>
                Masuk dasbor ↗
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid rgba(23,23,22,.14)", padding: "22px clamp(20px, 6vw, 88px)", display: "flex", gap: 12, alignItems: "center", fontSize: 13, color: "#74746d" }}>
        <Logo compact />
        <span style={{ marginLeft: "auto" }}>{nama} · SMS-LMS</span>
      </footer>

      <style>{`@media (max-width: 860px) {
        .portal-nav { display: none; }
        .portal-bottom { grid-template-columns: 1fr !important; }
      }`}</style>
    </div>
  );
}
