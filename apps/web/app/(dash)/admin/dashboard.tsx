"use client";

// Dasbor admin: denyut sekolah (jumlah warga, kelas, izin pending, pengumuman,
// antrean WA) + jalan pintas operasional. Semua angka dari API asli.
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { useFetch } from "@/app/lib/api";

export default function AdminDashboard() {
  const students = useFetch<{ rows: unknown[] }>("/api/students?perPage=100");
  const teachers = useFetch<{ rows: unknown[] }>("/api/teachers");
  const classes = useFetch<{ rows: unknown[] }>("/api/classes?perPage=100");
  const leave = useFetch<{ rows: { id: string }[] }>("/api/leave?status=PENDING");
  const ann = useFetch<{ rows: { id: string; title: string }[] }>("/api/announcements");
  const wa = useFetch<{ connected?: boolean; queue?: { waiting: number } }>("/api/wa/status");

  const pendingIzin = leave.data?.rows.length ?? 0;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Reveal>
        <section className="card" style={{ padding: "clamp(20px, 3vw, 32px)", background: "#171716", color: "#fffdf8" }}>
          <p className="kicker" style={{ color: "#f5c94a" }}>Pusat kendali sekolah</p>
          <h1 className="display" style={{ fontSize: "clamp(28px, 4vw, 46px)", margin: "8px 0" }}>
            Semua urusan,<br />satu meja.
          </h1>
          <p style={{ opacity: 0.8, maxWidth: 460, margin: "0 0 16px" }}>
            {pendingIzin > 0
              ? `${pendingIzin} pengajuan izin menunggu keputusan.`
              : "Antrean izin bersih."}{" "}
            {wa.data && wa.data.connected === false ? "Sesi WhatsApp putus — sambungkan ulang di halaman WA." : ""}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/import" className="btn-sticker" style={{ background: "#f5c94a", color: "#171716", borderColor: "#f5c94a" }}>
              Impor data ↗
            </Link>
            <Link href="/admin/wa" className="btn-sticker" style={{ background: "#fffdf8", color: "#171716", borderColor: "#fffdf8" }}>
              Status WhatsApp
            </Link>
          </div>
        </section>
      </Reveal>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 14 }} className="dash-metrics">
        <Reveal delay={60}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Siswa aktif</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {students.loading ? "…" : (students.data?.rows.length ?? 0)}
            </p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              <Link href="/admin/siswa" style={{ fontWeight: 700, color: "#171716" }}>Kelola siswa →</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Guru</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {teachers.loading ? "…" : (teachers.data?.rows.length ?? 0)}
            </p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              <Link href="/admin/guru" style={{ fontWeight: 700, color: "#171716" }}>Kelola guru →</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift" style={{ background: "#97c4db", padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, margin: 0 }}>Kelas</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {classes.loading ? "…" : (classes.data?.rows.length ?? 0)}
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              <Link href="/admin/kelas" style={{ fontWeight: 700, color: "#171716" }}>Kelola kelas →</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="card card-lift" style={{ background: pendingIzin > 0 ? "#e85e43" : "#aec6a4", color: pendingIzin > 0 ? "#fffdf8" : "#171716", padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, margin: 0, opacity: 0.9 }}>Izin pending</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {leave.loading ? "…" : pendingIzin}
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              {pendingIzin > 0 ? "Perlu perhatian" : "Semua beres"}
            </p>
          </div>
        </Reveal>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }} className="dash-bottom">
        <Reveal>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 12px" }}>Pengumuman terbaru</h2>
            {!ann.data ? (
              <p style={{ color: "#74746d" }}>Memuat…</p>
            ) : ann.data.rows.length === 0 ? (
              <p style={{ color: "#74746d" }}>
                Belum ada pengumuman. <Link href="/admin/pengumuman" style={{ fontWeight: 700, color: "#171716" }}>Buat pengumuman →</Link>
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {ann.data.rows.slice(0, 4).map((a) => (
                  <li key={a.id} style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 10, fontWeight: 700 }}>
                    {a.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="card" style={{ padding: 20, background: "#f5c94a" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 12px" }}>Operasional</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, fontSize: 14 }}>
              <li><Link href="/admin/kehadiran" style={{ fontWeight: 700, color: "#171716" }}>Kehadiran hari ini →</Link></li>
              <li><Link href="/admin/jadwal" style={{ fontWeight: 700, color: "#171716" }}>Jadwal pelajaran →</Link></li>
              <li><Link href="/admin/pengaturan" style={{ fontWeight: 700, color: "#171716" }}>Pengaturan sekolah →</Link></li>
              <li><Link href="/admin/audit" style={{ fontWeight: 700, color: "#171716" }}>Log audit →</Link></li>
            </ul>
          </div>
        </Reveal>
      </section>

      <style>{`@media (max-width: 860px) {
        .dash-metrics { grid-template-columns: 1fr 1fr !important; }
        .dash-bottom { grid-template-columns: 1fr !important; }
      }`}</style>
    </div>
  );
}
