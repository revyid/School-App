"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";

const Map = dynamic(() => import("./Map"), { ssr: false });
const BookSearch = dynamic(() => import("./BookSearch"), { ssr: false });

// Landing publik per sekolah. LAYOUT mengikuti referensi edukids
// (hero 3 kolom + orbit, intro split, 3 kartu fitur, grid mapel, pengumuman,
// panel CTA olive, footer gelap). ISI = data asli sekolah (portal/info),
// tanpa angka khayalan: kosong = ajakan.
type PortalInfo = {
  school: { name: string; lat: number | null; lng: number | null };
  portalName: string;
  ctaGtkUrl: string | null;
  ctaMuridUrl: string | null;
  announcements: { id: string; title: string; body: string; publishAt: string }[];
  counts: { students: number; teachers: number; classes: number };
  subjects: { id: string; name: string }[];
};

const SUBJECT_COLORS = ["#e85e43", "#f5c94a", "#97c4db", "#aec6a4"];
const SUBJECT_GLYPH = ["∑", "Aa", "✦", "◎"];

export default function PortalPage() {
  const info = useFetch<PortalInfo>("/api/portal/info");

  const nama = info.data?.school.name ?? "Sekolah";
  const ann = info.data?.announcements ?? [];
  const counts = info.data?.counts;
  const subjects = info.data?.subjects ?? [];

  return (
    <div style={{ background: "#eeeadd", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1600, margin: "0 auto", background: "#f7f4ec", overflow: "clip" }}>

        {/* NAVBAR */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            padding: "18px clamp(24px, 7vw, 112px)",
            minHeight: 82,
            position: "sticky",
            top: 0,
            zIndex: 30,
            background: "#f7f4ec",
            borderBottom: "1px solid rgba(23,23,22,.14)",
          }}
        >
          <Logo />
          <nav style={{ display: "flex", gap: "clamp(18px, 3vw, 44px)", marginLeft: "auto", fontSize: 12, fontWeight: 600 }} className="portal-nav">
            <a href="#tentang" style={{ color: "#74746d", textDecoration: "none" }}>Tentang</a>
            <a href="#program" style={{ color: "#74746d", textDecoration: "none" }}>Program</a>
            <a href="#mapel" style={{ color: "#74746d", textDecoration: "none" }}>Mapel</a>
            <a href="#pengumuman" style={{ color: "#74746d", textDecoration: "none" }}>Pengumuman</a>
            <a href="#lokasi" style={{ color: "#74746d", textDecoration: "none" }}>Lokasi</a>
          </nav>
          <a href="/login" className="btn-sticker" style={{ background: "#171716", color: "#fffdf8", textDecoration: "none" }}>
            Masuk ↗
          </a>
          <details className="portal-burger" style={{ position: "relative" }}>
            <summary aria-label="Buka menu" style={{ listStyle: "none", cursor: "pointer", display: "grid", placeItems: "center", width: 44, height: 44, border: "1px solid #171716", borderRadius: "50%", background: "#fffdf8", fontSize: 20 }}>☰</summary>
            <nav style={{ position: "absolute", right: 0, top: 52, display: "flex", flexDirection: "column", gap: 4, minWidth: 180, padding: 10, background: "#fffdf8", border: "1px solid #171716", borderRadius: 16, boxShadow: "4px 5px 0 #171716" }}>
              {[["Tentang", "#tentang"], ["Program", "#program"], ["Mapel", "#mapel"], ["Pengumuman", "#pengumuman"], ["Lokasi", "#lokasi"]].map(([label, href]) => (
                <a key={href} href={href} style={{ padding: "10px 12px", borderRadius: 10, color: "#171716", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>{label}</a>
              ))}
            </nav>
          </details>
        </header>

        {/* HERO 3 kolom ala contoh */}
        <section
          className="portal-hero"
          style={{
            display: "grid",
            gridTemplateColumns: "0.8fr minmax(360px, 1.4fr) 0.8fr",
            alignItems: "center",
            padding: "80px clamp(24px, 7vw, 112px) 34px",
            position: "relative",
            isolation: "isolate",
            overflow: "hidden",
          }}
        >
          <span className="anim-drift" aria-hidden="true" style={{ position: "absolute", top: "20%", left: "44%", color: "#e85e43", fontSize: 46, zIndex: 0 }}>✳</span>
          <span className="anim-drift" aria-hidden="true" style={{ position: "absolute", bottom: "32%", right: "42%", color: "#e85e43", fontSize: 24, zIndex: 0 }}>✦</span>
          <div aria-hidden="true" style={{ position: "absolute", left: "calc(50% - 240px)", top: "36%", width: 480, height: 165, border: "1px dashed rgba(232,94,67,.38)", borderRadius: "50%", transform: "rotate(-13deg)", zIndex: 0, pointerEvents: "none" }} />
          <div aria-hidden="true" style={{ position: "absolute", left: "calc(50% - 155px)", top: "41%", width: 310, height: 110, border: "1px dashed rgba(113,132,90,.35)", borderRadius: "50%", transform: "rotate(11deg)", zIndex: 0, pointerEvents: "none" }} />

          {/* kiri: siswi */}
          <div className="portal-hero-side hero-left" style={{ position: "relative", zIndex: 2, justifySelf: "start", width: "min(100%, 250px)", height: 370, transform: "rotate(-5deg)" }}>
            <div style={{ position: "absolute", inset: "40px 0 0", background: "#f5c94a", borderRadius: "48% 52% 38% 62% / 52% 41% 59% 48%", transform: "rotate(-10deg)" }} />
            <Image src="/assets/char-girl.png" alt="Ilustrasi siswi membawa buku" fill className="anim-floaty" style={{ objectFit: "contain", objectPosition: "center bottom" }} priority />
            <span style={{ position: "absolute", top: 36, left: -28, width: 52, height: 52, display: "grid", placeItems: "center", border: "1px solid #171716", borderRadius: "50%", background: "#fffdf8", boxShadow: "4px 5px 0 #171716", fontSize: 25 }} aria-hidden="true">✎</span>
            <span style={{ position: "absolute", bottom: 33, left: -60, padding: "10px 13px", border: "1px solid #171716", borderRadius: 14, background: "#fffdf8", fontFamily: "var(--font-meta)", fontSize: 8, textTransform: "uppercase", boxShadow: "3px 4px 0 #171716", transform: "rotate(-8deg)" }}>
              kelas<br /><strong style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>ceria</strong>
            </span>
          </div>

          {/* tengah: copy */}
          <Reveal className="portal-hero-copy">
            <div style={{ textAlign: "center", position: "relative", zIndex: 3 }}>
              <p className="kicker" style={{ justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e85e43", boxShadow: "0 0 0 5px rgba(232,94,67,.14)" }} />
                ruang tumbuh {nama.toLowerCase()}
              </p>
              <h1 className="display" style={{ fontSize: "clamp(44px, 5.4vw, 84px)", margin: "21px auto 19px", maxWidth: 640, lineHeight: 1.02 }}>
                Belajar seru,<br /><em style={{ fontStyle: "normal", color: "#e85e43" }}>mimpi</em> melaju.
              </h1>
              <p style={{ maxWidth: 370, margin: "0 auto", color: "#74746d", fontSize: 14, lineHeight: 1.75 }}>
                {nama}: pengumuman, bacaan, dan lokasi dalam satu halaman.
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 25, marginTop: 32, flexWrap: "wrap" }}>
                <a href="/login" className="btn-sticker btn-primary" style={{ textDecoration: "none", minHeight: 50, padding: "0 21px" }}>Mulai belajar ↗</a>
                <a href="#tentang" style={{ color: "#e85e43", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Kenalan dulu ↓</a>
              </div>
            </div>
          </Reveal>

          {/* kanan: siswa */}
          <div className="portal-hero-side hero-right" style={{ position: "relative", zIndex: 2, justifySelf: "end", width: "min(100%, 250px)", height: 370, transform: "rotate(6deg)" }}>
            <div style={{ position: "absolute", inset: "40px 0 0", background: "#97c4db", borderRadius: "48% 52% 38% 62% / 52% 41% 59% 48%", transform: "rotate(10deg)" }} />
            <Image src="/assets/char-student.png" alt="Ilustrasi siswa berkacamata membaca buku" fill className="anim-floaty" style={{ objectFit: "contain", objectPosition: "center bottom" }} priority />
            <span style={{ position: "absolute", top: 72, right: -27, width: 52, height: 52, display: "grid", placeItems: "center", border: "1px solid #171716", borderRadius: "50%", background: "#f5c94a", boxShadow: "4px 5px 0 #171716", fontSize: 25 }} aria-hidden="true">✺</span>
            <span style={{ position: "absolute", bottom: 66, right: -74, padding: "10px 13px", border: "1px solid #171716", borderRadius: 14, background: "#fffdf8", fontFamily: "var(--font-meta)", fontSize: 8, textTransform: "uppercase", boxShadow: "3px 4px 0 #171716", transform: "rotate(9deg)" }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{counts ? `${counts.students} siswa` : "…"}</strong><br />belajar di sini
            </span>
          </div>

          {/* bawah: statistik */}
          <div className="portal-hero-bottom" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, paddingTop: 32, borderTop: "1px solid rgba(23,23,22,.14)", marginTop: 20 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 9, color: "#74746d", fontFamily: "var(--font-meta)", fontSize: 9, textTransform: "uppercase" }}>
              <span style={{ display: "grid", placeItems: "center", width: 25, height: 25, border: "1px solid rgba(23,23,22,.14)", borderRadius: "50%" }}>↓</span>
              jelajahi sekolah
            </span>
            <div style={{ display: "flex", gap: "clamp(24px, 5vw, 90px)" }}>
              {[
                [counts?.students, "siswa"],
                [counts?.teachers, "guru"],
                [counts?.classes, "kelas"],
              ].map(([n, label]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <strong style={{ fontSize: 26, letterSpacing: "-0.08em" }}>
                    {n === undefined ? "…" : n}<span style={{ color: "#e85e43" }}>+</span>
                  </strong>
                  <span style={{ color: "#74746d", fontFamily: "var(--font-meta)", fontSize: 9, textTransform: "uppercase" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* INTRO split */}
        <section id="tentang" style={{ padding: "104px clamp(24px, 7vw, 112px)" }}>
          <Reveal>
            <p className="kicker" style={{ marginBottom: 42 }}>Tentang {nama}</p>
            <div className="portal-split">
              <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                Anak hebat tumbuh dari rasa <span style={{ color: "#e85e43" }}>ingin tahu.</span>
              </h2>
              <div>
                <p style={{ maxWidth: 400, marginBottom: 27, color: "#74746d", fontSize: 14, lineHeight: 1.75 }}>
                  {nama} mendampingi siswa belajar setiap hari: tugas, asesmen, kehadiran,
                  dan kabar sekolah, semua tercatat rapi dalam satu dasbor.
                </p>
                <a href="#program" style={{ color: "#171716", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Lihat program kami ↗</a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* 3 KARTU FITUR */}
        <section id="program" style={{ background: "#fffdf8", padding: "104px clamp(24px, 7vw, 112px)" }}>
          <Reveal>
            <div className="portal-split" style={{ marginBottom: 45 }}>
              <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                Kecil-kecil,<br /><span style={{ color: "#e85e43" }}>berani besar.</span>
              </h2>
              <p style={{ maxWidth: 245, color: "#74746d", fontSize: 12, lineHeight: 1.7 }}>
                Tiga hal yang membuat belajar di {nama} terasa dekat dan ingin diulang.
              </p>
            </div>
          </Reveal>
          <div className="portal-trio">
            {[
              { bg: "#e85e43", fg: "#fffdf8", glyph: "☼", title: "Tugas & materi", desc: "Tugas, materi, dan pengumpulan terpantau guru setiap hari." },
              { bg: "#71845a", fg: "#fffdf8", glyph: "✦", title: "Asesmen adil", desc: "Kuis dan ujian dengan soal acak per siswa, dinilai otomatis." },
              { bg: "#97c4db", fg: "#171716", glyph: "∞", title: "Kehadiran rapi", desc: "Absensi QR, izin berfoto, dan rekap bulanan siap unduh." },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 120}>
                <article
                  className="card-lift"
                  style={{ position: "relative", minHeight: 340, padding: "27px 27px 30px", borderRadius: 34, overflow: "hidden", background: f.bg, color: f.fg }}
                >
                  <div style={{ fontFamily: "var(--font-meta)", fontSize: 11, opacity: 0.68 }}>0{i + 1}</div>
                  <div style={{ display: "grid", placeItems: "center", width: 73, height: 73, margin: "36px 0 26px", border: "1px solid currentColor", borderRadius: "50%", fontSize: 34 }}>{f.glyph}</div>
                  <h3 className="display" style={{ fontSize: "clamp(22px, 2.1vw, 31px)", color: f.fg }}>{f.title}</h3>
                  <p style={{ maxWidth: 250, marginTop: 16, fontSize: 12, lineHeight: 1.65, opacity: 0.78 }}>{f.desc}</p>
                  <a href="/login" aria-label={f.title} style={{ position: "absolute", right: 27, bottom: 27, display: "grid", placeItems: "center", width: 35, height: 35, border: "1px solid currentColor", borderRadius: "50%", fontSize: 19, color: "inherit", textDecoration: "none" }}>↗</a>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* MAPEL */}
        <section id="mapel" style={{ padding: "104px clamp(24px, 7vw, 112px)" }}>
          <div className="portal-split" style={{ alignItems: "center" }}>
            <Reveal>
              <div>
                <p className="kicker" style={{ marginBottom: 20 }}>Peta belajar</p>
                <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                  Satu tempat,<br /><span style={{ color: "#e85e43" }}>seribu kemungkinan.</span>
                </h2>
                <p style={{ maxWidth: 390, margin: "26px 0 29px", color: "#74746d", fontSize: 13, lineHeight: 1.75 }}>
                  {subjects.length > 0
                    ? `Ada ${subjects.length} mata pelajaran aktif semester ini. Masuk untuk melihat tugas dan nilaimu.`
                    : "Jadwal dan mata pelajaran diatur admin sekolah. Masuk untuk melihat kelasmu."}
                </p>
                <a href="/login" className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>Masuk dasbor ↗</a>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="portal-duo">
                {(subjects.length > 0 ? subjects.slice(0, 4).map((s) => s.name) : ["Matematika", "Bahasa Indonesia", "IPA", "IPS"]).slice(0, 4).map((label, i) => (
                  <div
                    key={label}
                    className="card-lift"
                    style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 205, padding: 22, borderRadius: 24, overflow: "hidden", background: SUBJECT_COLORS[i % 4], border: subjects.length > 0 ? undefined : "2px dashed rgba(23,23,22,.35)" }}
                  >
                    <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, border: "1px solid currentColor", borderRadius: "50%", fontSize: 23 }}>{SUBJECT_GLYPH[i % 4]}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.04em" }}>{label}</span>
                    {subjects.length === 0 && (
                      <span style={{ fontFamily: "var(--font-meta)", fontSize: 9, textTransform: "uppercase", opacity: 0.7 }}>segera hadir</span>
                    )}
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PENGUMUMAN */}
        <section id="pengumuman" style={{ background: "#fffdf8", padding: "104px clamp(24px, 7vw, 112px)" }}>
          <Reveal>
            <div className="portal-split" style={{ marginBottom: 40 }}>
              <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                Kabar dari<br /><span style={{ color: "#e85e43" }}>sekolah.</span>
              </h2>
              <p style={{ maxWidth: 245, color: "#74746d", fontSize: 12, lineHeight: 1.7 }}>
                Pengumuman resmi {nama}. Masuk untuk kabar khusus kelasmu.
              </p>
            </div>
          </Reveal>
          {!info.data ? (
            <p style={{ color: "#74746d" }}>Memuat…</p>
          ) : ann.length === 0 ? (
            <div className="card" style={{ padding: 28 }}>
              <p style={{ color: "#74746d", margin: 0 }}>Belum ada pengumuman. Kembali lagi nanti.</p>
            </div>
          ) : (
            <div className="portal-trio">
              {ann.slice(0, 3).map((p, i) => (
                <Reveal key={p.id} delay={i * 120}>
                  <article
                    className="card-lift"
                    style={{ position: "relative", minHeight: 300, padding: "27px", borderRadius: 34, overflow: "hidden", background: ["#f5c94a", "#97c4db", "#aec6a4"][i % 3], transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 0.8}deg)` }}
                  >
                    <div style={{ fontFamily: "var(--font-meta)", fontSize: 11, opacity: 0.68 }}>
                      {new Date(p.publishAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <h3 className="display" style={{ fontSize: "clamp(20px, 2vw, 28px)", marginTop: 36 }}>{p.title}</h3>
                    <p style={{ maxWidth: 250, marginTop: 16, fontSize: 12, lineHeight: 1.65, opacity: 0.78, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.body}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* BACAAN */}
        <section id="bacaan" style={{ padding: "104px clamp(24px, 7vw, 112px)" }}>
          <div className="portal-split" style={{ marginBottom: 32 }}>
            <Reveal>
              <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                Cerita kecil,<br /><span style={{ color: "#e85e43" }}>ide besar.</span>
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <p style={{ maxWidth: 400, color: "#74746d", fontSize: 14, lineHeight: 1.75 }}>
                Rak bacaan digital: cari buku lewat katalog terbuka, baca kapan saja.
              </p>
            </Reveal>
          </div>
          <Reveal>
            <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)", background: "#50643e", color: "#fffdf8", borderColor: "#50643e" }}>
              <BookSearch />
            </div>
          </Reveal>
        </section>

        {/* CTA OLIVE */}
        <section style={{ background: "#fffdf8", padding: "48px clamp(24px, 7vw, 112px) 104px" }}>
          <Reveal>
            <div
              style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr .8fr", minHeight: 470, borderRadius: 34, overflow: "hidden", color: "#fffdf8", background: "#50643e" }}
              className="portal-cta"
            >
              <div style={{ position: "relative", zIndex: 2, alignSelf: "center", padding: "68px 0 68px clamp(27px, 6vw, 82px)" }}>
                <p className="kicker" style={{ color: "#f5c94a" }}>Mulai dari sini</p>
                <h2 className="display" style={{ margin: "18px 0 22px", fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                  Satu klik untuk<br /><span style={{ color: "#f5c94a" }}>lebih percaya diri.</span>
                </h2>
                <p style={{ maxWidth: 310, color: "rgba(255,253,248,.74)", fontSize: 13, lineHeight: 1.7, marginBottom: 28 }}>
                  Masuk ke dasbor {nama}: tugas, nilai, dan kabar kelas dalam genggaman.
                </p>
                <a href="/login" className="btn-sticker" style={{ background: "#fffdf8", color: "#171716", borderColor: "#fffdf8", textDecoration: "none" }}>Masuk dasbor ↗</a>
              </div>
              <div style={{ position: "relative", minHeight: 470, padding: "24px 28px 10px 0" }}>
                <div style={{ position: "absolute", left: "10%", top: "14%", width: 400, height: 400, maxWidth: "86%", maxHeight: "72%", borderRadius: "50%", background: "#f5c94a" }} />
                <Image src="/assets/char-girl.png" alt="Ilustrasi siswi tersenyum membawa buku" fill style={{ objectFit: "contain", objectPosition: "bottom center", zIndex: 2 }} />
                <span aria-hidden="true" className="anim-floaty" style={{ position: "absolute", zIndex: 3, top: "18%", right: "13%", display: "grid", placeItems: "center", width: 63, height: 63, border: "1px solid #171716", borderRadius: "50%", color: "#171716", fontSize: 30, background: "#fffdf8", boxShadow: "5px 6px 0 #171716" }}>✳</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* LOKASI */}
        <section id="lokasi" style={{ padding: "0 clamp(24px, 7vw, 112px) 104px" }}>
          <div className="portal-split" style={{ marginBottom: 28 }}>
            <Reveal>
              <h2 className="display" style={{ fontSize: "clamp(38px, 5.2vw, 72px)" }}>
                Temukan<br /><span style={{ color: "#e85e43" }}>kami.</span>
              </h2>
            </Reveal>
            <Reveal delay={100}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {info.data?.ctaGtkUrl && (
                  <a href={info.data.ctaGtkUrl} target="_blank" rel="noreferrer" className="btn-sticker btn-ghost" style={{ textDecoration: "none" }}>Ruang GTK ↗</a>
                )}
                {info.data?.ctaMuridUrl && (
                  <a href={info.data.ctaMuridUrl} target="_blank" rel="noreferrer" className="btn-sticker btn-primary" style={{ textDecoration: "none" }}>Ruang Murid ↗</a>
                )}
              </div>
            </Reveal>
          </div>
          <Reveal>
            <div className="card" style={{ padding: "clamp(20px, 3vw, 32px)" }}>
              {info.data && info.data.school.lat != null && info.data.school.lng != null ? (
                <Map lat={info.data.school.lat} lng={info.data.school.lng} />
              ) : (
                <p style={{ color: "#74746d", margin: 0 }}>Peta belum diatur oleh admin sekolah.</p>
              )}
            </div>
          </Reveal>
        </section>

        {/* FOOTER GELAP */}
        <footer style={{ padding: "80px clamp(24px, 7vw, 112px) 25px", color: "#fffdf8", background: "#171716" }}>
          <div className="portal-footer-top">
            <div>
              <Logo light />
              <p style={{ marginTop: 30, color: "rgba(255,253,248,.62)", fontSize: 18, lineHeight: 1.35, letterSpacing: "-0.055em" }}>
                Ruang kecil untuk<br /><strong style={{ color: "#f5c94a" }}>mimpi yang besar.</strong>
              </p>
            </div>
            <div className="portal-footer-links">
              <div>
                <span>Jelajah</span>
                <a href="#tentang">Tentang</a>
                <a href="#program">Program</a>
                <a href="#mapel">Mapel</a>
              </div>
              <div>
                <span>Sekolah</span>
                <a href="#pengumuman">Pengumuman</a>
                <a href="#bacaan">Bacaan</a>
                <a href="#lokasi">Lokasi</a>
              </div>
              <div>
                <span>Aksi</span>
                <a href="/login">Masuk ↗</a>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 20, paddingTop: 19, borderTop: "1px solid rgba(255,255,255,.15)", color: "rgba(255,253,248,.6)", fontFamily: "var(--font-meta)", fontSize: 10, textTransform: "uppercase" }}>
            <span>{nama}</span>
            <span>SMS-LMS</span>
          </div>
        </footer>
      </div>

      <style>{`section[id] { scroll-margin-top: 96px; }
      @media (max-width: 900px) {
        .portal-nav { display: none; }
        .portal-hero { grid-template-columns: .7fr 1.5fr .7fr; }
        .portal-hero-side { width: 190px !important; height: 310px !important; }
      }
      @media (max-width: 680px) {
        .portal-hero { grid-template-columns: 1fr 1fr; grid-template-rows: auto 255px auto; padding-top: 62px; }
        .portal-hero-copy { grid-column: 1 / -1; grid-row: 1; margin-bottom: 25px; }
        .portal-hero-side { width: 160px !important; height: 250px !important; margin: 0; }
        .hero-left { grid-column: 1; grid-row: 2; }
        .hero-right { grid-column: 2; grid-row: 2; }
        .portal-hero-bottom { grid-column: 1 / -1; grid-row: 3; display: block; }
        .portal-split { display: grid !important; gap: 26px; }
        .portal-trio { display: grid !important; gap: 16px; }
        .portal-duo { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 10px; margin-top: 28px; }
        .portal-cta { display: block !important; }
        .portal-footer-top { display: block; padding-bottom: 62px; }
        .portal-footer-links { display: grid; gap: 26px; margin-top: 40px; }
        .portal-burger { display: grid !important; }
      }
      @media (min-width: 681px) {
        .portal-split { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr); gap: 8vw; align-items: end; }
        .portal-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .portal-duo { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
        .portal-footer-top { display: flex; justify-content: space-between; gap: 50px; padding-bottom: 90px; }
        .portal-footer-links { display: grid; grid-template-columns: repeat(3, minmax(100px, 1fr)); gap: clamp(34px, 7vw, 105px); }
        .portal-footer-links div { display: flex; flex-direction: column; gap: 13px; }
        .portal-footer-links span { margin-bottom: 10px; color: #f5c94a; font-family: var(--font-meta); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
        .portal-footer-links a { color: rgba(255,253,248,.7); font-size: 12px; text-decoration: none; }
        .portal-burger { display: none; }
      }`}</style>
    </div>
  );
}
