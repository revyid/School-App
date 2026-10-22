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
  // Gambar karakter sekolah (bila diunggah admin) dengan fallback aset lama.
  const brand = useFetch<{ settings: { characterImageUrl?: string | null; bookImageUrl?: string | null; heroImageUrl?: string | null } }>("/api/settings");

  const rows = tasks.data?.rows ?? [];
  const belum = rows.filter((t) => t.state === "BELUM" || t.state === "TERLAMBAT").length;
  const sudah = rows.filter((t) => t.state === "SUDAH").length;
  const pct = rows.length === 0 ? 0 : Math.round((sudah / rows.length) * 100);
  const pertama = profile.data?.user.name.split(" ")[0] ?? "Teman";
  const points = exp.data?.points ?? 0;
  const badges = exp.data?.badges ?? [];
  const menunggu = rows.filter((t) => t.state === "BELUM" || t.state === "TERLAMBAT").slice(0, 4);

  return (
    <div className="grid gap-5">
      {/* HERO */}
      <Reveal>
        <section
          className="card relative flex items-center gap-4 overflow-hidden p-5 md:p-9"
        >
          <div className="relative z-[2] min-w-0 flex-1">
            <p className="kicker">
              {HARI[now.getDay()]}, {now.getDate()} {BULAN[now.getMonth()]} {now.getFullYear()}
            </p>
            <h1 className="display text-[clamp(30px,4.5vw,52px)] my-2">
              Siap menemukan<br />
              <span className="text-terracotta">hal baru hari ini?</span>
            </h1>
            <p className="text-muted mb-4 max-w-[420px]">
              Halo, {pertama}! {belum > 0 ? `${belum} tugas menunggumu — sedikit lagi.` : "Semua tugas beres. Pertahankan!"}
              {profile.data?.user.studentProfile?.class && <> Kelas {profile.data.user.studentProfile.class.name}.</>}
            </p>
            <Link href="/siswa/kelasku" className="btn-sticker btn-primary">
              Lanjut belajar
            </Link>
          </div>
          <div className="dash-hero-char relative shrink-0">
            <div
              // dynamic: blob shape dekoratif maskot, bukan warna teks
              className="absolute bg-sun z-0 inset-[8%_-6%] rounded-[48%_52%_55%_45%_/_50%_46%_54%_50%]"
             
            />
            <Image
              src={brand.data?.settings.characterImageUrl ? "/api/portal/branding?kind=character" : "/assets/student-hero-transparent.png"}
              unoptimized
              onError={(e) => { e.currentTarget.src = "/assets/student-hero-transparent.png"; }}
              alt="Maskot siswa"
              width={220}
              height={260}
              className="anim-floaty relative z-[1] object-contain"
              priority
            />
          </div>
        </section>
      </Reveal>

      {/* METRIK */}
      <section className="dash-metrics grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-3.5">
        <Reveal delay={60}>
          <div className="card card-lift bg-olive-deep text-cream p-4.5 min-h-[150px]">
            <p className="text-xs opacity-85 m-0">Tugas selesai</p>
            <p className="display text-4xl my-1.5">{tasks.loading ? "…" : tasks.error ? "—" : `${sudah}/${rows.length}`}</p>
            <p className="text-xs text-sun-soft m-0">{pct}% dari semua tugas</p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift bg-sun p-4.5 min-h-[150px]">
            <p className="text-xs m-0">Bintang terkumpul</p>
            <p className="display text-4xl my-1.5">{exp.loading ? "…" : exp.error ? "—" : points}</p>
            <p className="text-xs m-0">poin EXP</p>
          </div>
        </Reveal>
      </section>

      {/* BAWAH */}
      <section className="dash-bottom grid grid-cols-[1.2fr_1fr] gap-3.5">
        <Reveal>
          <div className="card p-5">
            <h2 className="text-[17px] font-extrabold tracking-[-0.02em] mb-3">
              Tugas menunggu
            </h2>
            {tasks.loading ? (
              <p className="text-muted">Memuat…</p>
            ) : tasks.error ? (
              <p role="alert" className="text-terracotta-dark font-bold">Tugas gagal dimuat. Muat ulang halaman.</p>
            ) : menunggu.length === 0 ? (
              <p className="text-muted">
                Tidak ada tugas menunggu. {rows.length === 0 ? "Gurumu belum memberikan tugas." : "Semua sudah dikumpulkan!"}
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-2.5 p-0">
                {menunggu.map((t) => (
                  <li key={t.id} className="border-t border-line pt-2.5">
                    <Link href={`/siswa/kelasku?tugas=${t.id}`} className="font-bold text-ink">
                      {t.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
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
          <div className="card bg-sky p-5">
            <h2 className="text-[17px] font-extrabold tracking-[-0.02em] mb-3">
              Lencanaku
            </h2>
            {badges.length === 0 ? (
              <p className="text-[13px]">Belum ada lencana. Kumpulkan EXP dari tugas, asesmen, dan kehadiran!</p>
            ) : (
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {badges.map((b) => (
                  <li
                    key={b.name}
                    className="anim-breathe bg-cream border border-ink rounded-full px-3.5 py-1.5 text-[12.5px] font-bold"
                  >
                    {b.name}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3.5">
              <Link href="/siswa/leaderboard" className="font-bold text-ink">
                Lihat papan peringkat
              </Link>
            </p>
          </div>
        </Reveal>
      </section>

      <style>{`@media (max-width: 860px) {
        .dash-metrics { grid-template-columns: 1fr 1fr !important; }
        .dash-bottom { grid-template-columns: 1fr !important; }
        .dash-hero-char {
          display: block !important;
          position: absolute !important;
          right: -14px !important;
          bottom: -14px !important;
          width: 150px !important;
          height: 150px !important;
          opacity: 0.25 !important;
          pointer-events: none !important;
          z-index: 1 !important;
        }
      }
      @media (max-width: 480px) { .dash-metrics { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
