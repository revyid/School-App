"use client";

// Dasbor admin: denyut sekolah (jumlah warga, kelas, izin pending, pengumuman,
// antrean WA) + jalan pintas operasional. Semua angka dari API asli.
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const students = useFetch<{ rows: unknown[]; total: number }>("/api/students?perPage=1");
  const teachers = useFetch<{ rows: unknown[]; total: number }>("/api/teachers?perPage=1");
  const classes = useFetch<{ rows: unknown[]; total: number }>("/api/classes?perPage=1");
  const leave = useFetch<{ rows: { id: string }[] }>("/api/leave?status=PENDING");
  const ann = useFetch<{ rows: { id: string; title: string }[] }>("/api/announcements");
  const wa = useFetch<{ connected?: boolean; queue?: { waiting: number } }>("/api/wa/status");
  const brand = useFetch<{ settings: { characterImageUrl?: string | null } }>("/api/settings");

  const pendingIzin = leave.data?.rows.length ?? 0;
  const metric = (hook: { loading: boolean; error?: unknown; data?: { total?: number; rows?: unknown[] } | null }) => hook.loading ? "…" : hook.error ? "—" : (hook.data?.total ?? hook.data?.rows?.length ?? 0);

  return (
    <div className="grid gap-5">
      <Reveal>
        <section className="card p-[clamp(20px,_3vw,_32px)] bg-ink text-cream flex items-center gap-[24px] overflow-hidden relative">
          <div className="flex-1 min-w-[0px] relative z-[2]">
          <p className="kicker text-sun-soft">Pusat kendali sekolah</p>
          <h1 className="display text-[clamp(28px,_4vw,_46px)] mt-2 mr-0 mb-2 ml-0">
            Semua urusan,<br />satu meja.
          </h1>
          <p className="opacity-[0.8] max-w-[460px] mt-0 mr-0 mb-4 ml-0">
            {pendingIzin > 0
              ? `${pendingIzin} pengajuan izin menunggu keputusan.`
              : "Antrean izin bersih."}{" "}
            {wa.data && wa.data.connected === false ? "Sesi WhatsApp putus — sambungkan ulang di halaman WA." : ""}
          </p>
          <div className="flex gap-[10px] flex-wrap">
            <Link href="/admin/pengguna?tab=siswa" className="btn-sticker bg-sun text-ink border-sun">
              Impor data
            </Link>
            <Link href="/admin/wa" className="btn-sticker bg-cream text-ink border-cream">
              Status WhatsApp
            </Link>
          </div>
          </div>
          <div className="dash-hero-char relative shrink-0 w-[180px] h-[180px]">
            <Image
              src={brand.data?.settings.characterImageUrl ? "/api/portal/branding?kind=character" : "/assets/student-book.png"}
              alt="Operasional sekolah"
              fill
              className="anim-floaty object-contain rounded-2xl z-[1]"
             
              priority
            />
          </div>
        </section>
      </Reveal>

      <section className="dash-metrics grid grid-cols-[repeat(auto-fit,minmax(148px,1fr))] gap-[14px]">
        <Reveal delay={60}>
          <div className="card card-lift p-[18px] min-h-[148px]">
            <p className="text-xs text-muted m-0">Siswa aktif</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {students.loading ? "…" : metric(students)}
            </p>
            <p className="text-xs text-muted m-0">
              <Link className="font-bold text-ink" href="/admin/pengguna?tab=siswa">Kelola siswa</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="card card-lift p-[18px] min-h-[148px]">
            <p className="text-xs text-muted m-0">Guru</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {teachers.loading ? "…" : metric(teachers)}
            </p>
            <p className="text-xs text-muted m-0">
              <Link className="font-bold text-ink" href="/admin/pengguna?tab=guru">Kelola guru</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift bg-sky p-[18px] min-h-[148px]">
            <p className="text-xs m-0">Kelas</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {classes.loading ? "…" : metric(classes)}
            </p>
            <p className="text-xs m-0">
              <Link className="font-bold text-ink" href="/admin/kelas">Kelola kelas</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className={cn("card card-lift p-[18px] min-h-[148px]", pendingIzin > 0 ? "bg-terracotta-deep text-cream" : "bg-mint text-ink")}>
            <p className="text-xs m-0 opacity-[0.9]">Izin pending</p>
            <p className="display text-[40px] mt-1.5 mr-0 mb-1.5 ml-0">
              {leave.loading ? "…" : leave.error ? "—" : pendingIzin}
            </p>
            <p className="text-xs m-0">
              {pendingIzin > 0 ? "Perlu perhatian" : "Semua beres"}
            </p>
          </div>
        </Reveal>
      </section>

      <section className="dash-bottom grid grid-cols-[1.2fr_1fr] gap-[14px]">
        <Reveal>
          <div className="card p-5">
            <h2 className="text-[17px] font-extrabold mt-0 mr-0 mb-3 ml-0">Pengumuman terbaru</h2>
            {ann.loading ? (
              <p className="text-muted">Memuat…</p>
            ) : ann.error ? (
              <p className="text-terracotta-dark" role="alert">Pengumuman gagal dimuat. Muat ulang halaman.</p>
            ) : !ann.data ? (
              <p className="text-muted">Pengumuman belum tersedia.</p>
            ) : ann.data.rows.length === 0 ? (
              <p className="text-muted">
                Belum ada pengumuman. <Link className="font-bold text-ink" href="/admin/pengumuman">Buat pengumuman</Link>
              </p>
            ) : (
              <ul className="list-none m-0 p-0 grid gap-[10px]">
                {ann.data.rows.slice(0, 4).map((a) => (
                  <li className="border-t border-line pt-[10px] font-bold" key={a.id}>
                    {a.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="card p-5 bg-sun">
            <h2 className="text-[17px] font-extrabold mt-0 mr-0 mb-3 ml-0">Operasional</h2>
            <ul className="list-none m-0 p-0 grid gap-[10px] text-sm">
              <li><Link className="font-bold text-ink" href="/admin/kehadiran">Kehadiran hari ini</Link></li>
              <li><Link className="font-bold text-ink" href="/admin/jadwal">Jadwal pelajaran</Link></li>
              <li><Link className="font-bold text-ink" href="/admin/pengaturan">Pengaturan sekolah</Link></li>
              <li><Link className="font-bold text-ink" href="/admin/audit">Log audit</Link></li>
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
          width: 140px !important;
          height: 140px !important;
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
