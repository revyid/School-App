"use client";

// Dasbor guru: hero kerja + metrik kelasnya + antrean (izin pending, absensi hari ini,
// tugas). Semua angka dari API asli; kosong = ajakan, bukan nol khayalan.
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";

function todayStr(): string {
  const n = new Date(Date.now() + 7 * 3600 * 1000);
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

export default function GuruDashboard() {
  const me = useFetch<{ user: { name: string } }>("/api/profile");
  const assign = useFetch<{ rows: { id: string; class: { id: string; name: string } }[] }>("/api/assignments");
  const tasks = useFetch<{
    rows: { id: string; title: string; class: { name: string }; _count: { submissions: number } }[];
  }>("/api/tasks");
  const leave = useFetch<{ rows: { id: string }[] }>("/api/leave?status=PENDING");
  // Gambar karakter sekolah (bila diunggah admin) dengan fallback ilustrasi lama.
  const brand = useFetch<{ settings: { characterImageUrl?: string | null } }>("/api/settings");

  const kelas = assign.data?.rows ?? [];
  const kelasUnik = Array.from(new Map(kelas.map((k) => [k.class.id, k])).values());
  const firstClass = kelasUnik[0]?.class.id ?? "";
  const daily = useFetch<{ summary: Record<string, number> }>(
    firstClass ? `/api/attendance/daily?date=${todayStr()}&classId=${firstClass}` : null,
  );

  const fullName = me.data?.user.name ?? "";
  const parts = fullName.split(" ").filter(Boolean);
  // "Bu Sinta"/"Pak Budi" = dua kata; nama biasa = kata pertama.
  const nama = parts.length === 0 ? "Bu/Pak Guru"
    : /^(bu|pak|ibu|bpk)$/i.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
  const pendingIzin = leave.data?.rows.length ?? 0;
  const s = daily.data?.summary;
  const belumAbsen = s ? (s.BELUM ?? 0) : 0;

  return (
    <div className="grid gap-5">
      <Reveal>
        <section
          className="card flex items-center gap-4 p-[clamp(20px,_3vw,_36px)] overflow-hidden relative bg-olive-deep text-cream border-olive-deep"
         
        >
          <div className="flex-1 min-w-[0px] relative z-[2]">
            <p className="kicker text-sun-soft">Ruang kerja guru</p>
            <h1 className="display text-[clamp(28px,_4vw,_46px)] mt-2 mr-0 mb-2 ml-0">
              Halo, {nama}!<br />
              Kelas menunggumu.
            </h1>
            <p className="opacity-[0.85] max-w-[440px] mt-0 mr-0 mb-4 ml-0">
              {pendingIzin > 0
                ? `${pendingIzin} pengajuan izin perlu keputusanmu hari ini.`
                : belumAbsen > 0
                  ? `${belumAbsen} siswa belum tercatat kehadirannya.`
                  : "Semua antrean beres. Fokus mengajar!"}
            </p>
            <div className="flex gap-[10px] flex-wrap">
              <Link href="/guru/scanner" className="btn-sticker bg-sun text-ink border-ink">
                Pindai kehadiran
              </Link>
              <Link href="/guru/tugas/new" className="btn-sticker btn-ghost">
                Buat tugas
              </Link>
            </div>
          </div>
          <div className="dash-hero-char relative shrink-0">
            <div className="absolute inset-[8%_-6%] bg-sun rounded-[52%_48%_45%_55%_/_50%_54%_46%_50%] z-0"
              
            />
            <Image
              src={brand.data?.settings.characterImageUrl ? "/api/portal/branding?kind=character" : "/assets/classroom-illustration.png"}
              alt="Ilustrasi ruang kelas"
              width={200}
              height={240}
              className="anim-floaty relative z-[1] object-cover rounded-2xl"
             
              priority
            />
          </div>
        </section>
      </Reveal>

      <section className="dash-metrics grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-[14px]">
        <Reveal delay={60}>
          <div className="card card-lift p-[18px] min-h-[148px]">
            <p className="text-xs text-muted m-0">Kelas diampu</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {assign.loading ? "…" : kelasUnik.length}
            </p>
            <p className="text-xs text-muted m-0">
              {kelas.length > 0 ? kelasUnik.map((k) => k.class.name).slice(0, 2).join(", ") + (kelas.length > 2 ? "…" : "") : "Belum ada penugasan"}
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="card card-lift bg-terracotta-deep text-cream border-terracotta p-[18px] min-h-[148px]">
            <p className="text-xs opacity-[0.9] m-0">Izin menunggu</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {leave.loading ? "…" : pendingIzin}
            </p>
            <p className="text-xs m-0">
              <Link className="text-cream font-bold" href="/guru/izin">Tinjau sekarang</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift p-[18px] min-h-[148px]">
            <p className="text-xs text-muted m-0">Belum absen hari ini</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {!s ? "…" : belumAbsen}
            </p>
            <p className="text-xs text-muted m-0">
              {s ? `Hadir ${s.HADIR ?? 0} · Izin ${s.IZIN ?? 0} · Sakit ${s.SAKIT ?? 0} · Alpha ${s.ALPHA ?? 0}` : (kelasUnik[0]?.class.name ?? "")}
            </p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="card card-lift bg-sun p-[18px] min-h-[148px]">
            <p className="text-xs m-0">Tugas aktif</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {tasks.loading ? "…" : (tasks.data?.rows.length ?? 0)}
            </p>
            <p className="text-xs m-0">
              {tasks.data && tasks.data.rows.length > 0
                ? `${tasks.data.rows.reduce((a, t) => a + t._count.submissions, 0)} pengumpulan masuk`
                : "Belum ada tugas"}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="dash-bottom grid grid-cols-[1.2fr_1fr] gap-[14px]">
        <Reveal>
          <div className="card p-5">
            <h2 className="text-[17px] font-extrabold mt-0 mr-0 mb-3 ml-0">Tugas terbarumu</h2>
            {tasks.loading ? (
              <p className="text-muted">Memuat…</p>
            ) : tasks.error ? (
              <p className="text-terracotta-dark" role="alert">Tugas gagal dimuat. Muat ulang halaman.</p>
            ) : !tasks.data ? (
              <p className="text-muted">Tugas belum tersedia.</p>
            ) : tasks.data.rows.length === 0 ? (
              <p className="text-muted">
                Belum ada tugas. <Link className="font-bold text-ink" href="/guru/tugas">Buat tugas pertama</Link>
              </p>
            ) : (
              <ul className="list-none m-0 p-0 grid gap-[10px]">
                {tasks.data.rows.slice(0, 4).map((t) => (
                  <li className="border-t border-line pt-[10px]" key={t.id}>
                    <Link className="font-bold text-ink" href={`/guru/tugas/${t.id}`}>
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted mt-[2px] mr-0 mb-0 ml-0">
                      {t.class.name} · {t._count.submissions} pengumpulan
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="card p-5 bg-mint">
            <h2 className="text-[17px] font-extrabold mt-0 mr-0 mb-3 ml-0">Tautan</h2>
            <ul className="list-none m-0 p-0 grid gap-2 text-sm">
              {[
                { href: "/guru/scanner", label: "Pindai QR kehadiran" },
                { href: "/guru/kehadiran", label: "Rekap kehadiran" },
                { href: "/guru/tugas?jenis=asesmen", label: "Asesmen" },
                { href: "/guru/rapor", label: "Rapor" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="card block pt-[10px] pr-[14px] pb-[10px] pl-[14px] font-bold text-ink bg-cream">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
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
