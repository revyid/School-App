"use client";

// Dasbor siswa ala referensi: hero sapaan + maskot, 4 kartu metrik (data ASLI API),
// grid bawah: tugas menunggu + lencana. Tanpa angka khayalan — kosong = ajakan.
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const BULAN = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

export default function SiswaDashboard() {
  const now = new Date();
  const profile = useFetch<{
    user: { name: string; nisn: string | null; studentProfile: { class: { name: string } | null } | null };
  }>("/api/profile");
  const tasks = useFetch<{ rows: { id: string; title: string; state: string; deadline: string | null }[] }>(
    "/api/tasks?status=semua",
  );
  const exp = useFetch<{ points: number; badges: { name: string; awardedAt: string }[] }>("/api/exp/me");

  const rows = tasks.data?.rows ?? [];
  const belum = rows.filter((t) => t.state === "BELUM").length;
  const sudah = rows.filter((t) => t.state === "SUDAH").length;
  const pct = rows.length === 0 ? 0 : Math.round((sudah / rows.length) * 100);
  const pertama = profile.data?.user.name.split(" ")[0] ?? "Teman";
  const points = exp.data?.points ?? 0;
  const badges = exp.data?.badges ?? [];
  const menunggu = rows.filter((t) => t.state === "BELUM" || t.state === "TERLAMBAT").slice(0, 4);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* HERO */}
      <Reveal>
        <section
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "clamp(20px, 3vw, 36px)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
            <p className="kicker">
              {HARI[now.getDay()]}, {now.getDate()} {BULAN[now.getMonth()]} {now.getFullYear()}
            </p>
            <h1 className="display" style={{ fontSize: "clamp(30px, 4.5vw, 52px)", margin: "8px 0" }}>
              Siap menemukan<br />
              <span style={{ color: "#e85e43" }}>hal baru hari ini?</span>
            </h1>
            <p style={{ color: "#74746d", maxWidth: 420, margin: "0 0 16px" }}>
              Halo, {pertama}! {belum > 0 ? `${belum} tugas menunggumu — sedikit lagi.` : "Semua tugas beres. Pertahankan!"}
              {profile.data?.user.studentProfile?.class && <> Kelas {profile.data.user.studentProfile.class.name}.</>}
            </p>
            <Link href="/siswa/tugas" className="btn-sticker btn-primary">
              Lanjut belajar ↗
            </Link>
          </div>
          <div className="dash-hero-char" style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: "8% -6%",
                background: "#f5c94a",
                borderRadius: "48% 52% 55% 45% / 50% 46% 54% 50%",
                zIndex: 0,
              }}
            />
            <Image
              src="/assets/char-student.png"
              alt="Maskot siswa"
              width={220}
              height={260}
              className="anim-floaty"
              style={{ position: "relative", zIndex: 1, objectFit: "contain" }}
              priority
            />
          </div>
        </section>
      </Reveal>

      {/* METRIK */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="dash-metrics">
        <Reveal delay={60}>
          <div className="card card-lift" style={{ background: "#50643e", color: "#fffdf8", padding: 18, minHeight: 150 }}>
            <p style={{ fontSize: 12, opacity: 0.85, margin: 0 }}>Tugas selesai</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>{tasks.loading ? "…" : `${sudah}/${rows.length}`}</p>
            <p style={{ fontSize: 12, color: "#f5c94a", margin: 0 }}>{pct}% dari semua tugas</p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 150 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Menunggu dikerjakan</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>{tasks.loading ? "…" : belum}</p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              {belum > 0 ? "Yuk cicil satu per satu" : "Bersih, kerja bagus!"}
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift" style={{ background: "#f5c94a", padding: 18, minHeight: 150 }}>
            <p style={{ fontSize: 12, margin: 0 }}>Bintang terkumpul</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>{exp.loading ? "…" : points}</p>
            <p style={{ fontSize: 12, margin: 0 }}>poin EXP</p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 150 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Lencana</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>{exp.loading ? "…" : badges.length}</p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              {badges.length > 0 ? badges[badges.length - 1].name : "Belum ada — kumpulkan!"}
            </p>
          </div>
        </Reveal>
      </section>

      {/* BAWAH */}
      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }} className="dash-bottom">
        <Reveal>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
              Tugas menunggu
            </h2>
            {tasks.loading ? (
              <p style={{ color: "#74746d" }}>Memuat…</p>
            ) : menunggu.length === 0 ? (
              <p style={{ color: "#74746d" }}>
                Tidak ada tugas menunggu. {rows.length === 0 ? "Gurumu belum memberikan tugas." : "Semua sudah dikumpulkan!"}
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {menunggu.map((t) => (
                  <li key={t.id} style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 10 }}>
                    <Link href={`/siswa/tugas/${t.id}`} style={{ fontWeight: 700, color: "#171716" }}>
                      {t.title}
                    </Link>
                    <p style={{ fontSize: 12, color: "#74746d", margin: "2px 0 0" }}>
                      {t.state === "TERLAMBAT" ? "Terlambat" : "Belum dikumpulkan"}
                      {t.deadline ? ` · tenggat ${new Date(t.deadline).toLocaleDateString("id-ID")}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="card" style={{ padding: 20, background: "#97c4db" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
              Lencanaku
            </h2>
            {badges.length === 0 ? (
              <p style={{ fontSize: 13 }}>Belum ada lencana. Kumpulkan EXP dari tugas, asesmen, dan kehadiran!</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {badges.map((b) => (
                  <li
                    key={b.name}
                    className="anim-breathe"
                    style={{
                      background: "#fffdf8",
                      border: "1px solid #171716",
                      borderRadius: 999,
                      padding: "6px 14px",
                      fontSize: 12.5,
                      fontWeight: 700,
                    }}
                  >
                    ★ {b.name}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: "14px 0 0" }}>
              <Link href="/siswa/leaderboard" style={{ fontWeight: 700, color: "#171716" }}>
                Lihat papan peringkat →
              </Link>
            </p>
          </div>
        </Reveal>
      </section>

      <style>{`@media (max-width: 860px) {
        .dash-metrics { grid-template-columns: 1fr 1fr !important; }
        .dash-bottom { grid-template-columns: 1fr !important; }
        .dash-hero-char { display: none; }
      }`}</style>
    </div>
  );
}
