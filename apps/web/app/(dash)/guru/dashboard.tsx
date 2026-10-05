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
  const assign = useFetch<{ rows: { id: string; class: { name: string } }[] }>("/api/assignments");
  const tasks = useFetch<{
    rows: { id: string; title: string; class: { name: string }; _count: { submissions: number } }[];
  }>("/api/tasks");
  const leave = useFetch<{ rows: { id: string }[] }>("/api/leave?status=PENDING");

  const kelas = assign.data?.rows ?? [];
  const firstClass = kelas[0]?.id ?? "";
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
    <div style={{ display: "grid", gap: 20 }}>
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
            background: "#50643e",
            color: "#fffdf8",
            borderColor: "#50643e",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 2 }}>
            <p className="kicker" style={{ color: "#f5c94a" }}>Ruang kerja guru</p>
            <h1 className="display" style={{ fontSize: "clamp(28px, 4vw, 46px)", margin: "8px 0" }}>
              Halo, {nama}!<br />
              Kelas menunggumu.
            </h1>
            <p style={{ opacity: 0.85, maxWidth: 440, margin: "0 0 16px" }}>
              {pendingIzin > 0
                ? `${pendingIzin} pengajuan izin perlu keputusanmu hari ini.`
                : belumAbsen > 0
                  ? `${belumAbsen} siswa belum tercatat kehadirannya.`
                  : "Semua antrean beres. Fokus mengajar!"}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/guru/scanner" className="btn-sticker" style={{ background: "#f5c94a", color: "#171716", borderColor: "#171716" }}>
                Pindai kehadiran ↗
              </Link>
              <Link href="/guru/tugas" className="btn-sticker btn-ghost">
                Kelola tugas
              </Link>
            </div>
          </div>
          <div className="dash-hero-char" style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: "8% -6%",
                background: "#f5c94a",
                borderRadius: "52% 48% 45% 55% / 50% 54% 46% 50%",
                zIndex: 0,
              }}
            />
            <Image
              src="/assets/char-girl.png"
              alt="Ilustrasi pendidik"
              width={200}
              height={240}
              className="anim-floaty"
              style={{ position: "relative", zIndex: 1, objectFit: "contain" }}
              priority
            />
          </div>
        </section>
      </Reveal>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="dash-metrics">
        <Reveal delay={60}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Kelas diampu</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {assign.loading ? "…" : kelas.length}
            </p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              {kelas.length > 0 ? kelas.map((k) => k.class.name).slice(0, 2).join(", ") + (kelas.length > 2 ? "…" : "") : "Belum ada penugasan"}
            </p>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="card card-lift" style={{ background: "#e85e43", color: "#fffdf8", borderColor: "#c94b35", padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, opacity: 0.9, margin: 0 }}>Izin menunggu</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {leave.loading ? "…" : pendingIzin}
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              <Link href="/guru/izin" style={{ color: "#fffdf8", fontWeight: 700 }}>Tinjau sekarang →</Link>
            </p>
          </div>
        </Reveal>
        <Reveal delay={180}>
          <div className="card card-lift" style={{ padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>Belum absen hari ini</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {!s ? "…" : belumAbsen}
            </p>
            <p style={{ fontSize: 12, color: "#74746d", margin: 0 }}>
              {s ? `Hadir ${s.HADIR ?? 0} · Izin ${s.IZIN ?? 0} · Sakit ${s.SAKIT ?? 0} · Alpha ${s.ALPHA ?? 0}` : (kelas[0]?.class.name ?? "")}
            </p>
          </div>
        </Reveal>
        <Reveal delay={240}>
          <div className="card card-lift" style={{ background: "#f5c94a", padding: 18, minHeight: 148 }}>
            <p style={{ fontSize: 12, margin: 0 }}>Tugas aktif</p>
            <p className="display" style={{ fontSize: 40, margin: "6px 0" }}>
              {tasks.loading ? "…" : (tasks.data?.rows.length ?? 0)}
            </p>
            <p style={{ fontSize: 12, margin: 0 }}>
              {tasks.data && tasks.data.rows.length > 0
                ? `${tasks.data.rows.reduce((a, t) => a + t._count.submissions, 0)} pengumpulan masuk`
                : "Belum ada tugas"}
            </p>
          </div>
        </Reveal>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }} className="dash-bottom">
        <Reveal>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 12px" }}>Tugas terbarumu</h2>
            {!tasks.data ? (
              <p style={{ color: "#74746d" }}>Memuat…</p>
            ) : tasks.data.rows.length === 0 ? (
              <p style={{ color: "#74746d" }}>
                Belum ada tugas. <Link href="/guru/tugas" style={{ fontWeight: 700, color: "#171716" }}>Buat tugas pertama →</Link>
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {tasks.data.rows.slice(0, 4).map((t) => (
                  <li key={t.id} style={{ borderTop: "1px solid rgba(23,23,22,.14)", paddingTop: 10 }}>
                    <Link href={`/guru/tugas/${t.id}`} style={{ fontWeight: 700, color: "#171716" }}>
                      {t.title}
                    </Link>
                    <p style={{ fontSize: 12, color: "#74746d", margin: "2px 0 0" }}>
                      {t.class.name} · {t._count.submissions} pengumpulan
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
        <Reveal delay={100}>
          <div className="card" style={{ padding: 20, background: "#aec6a4" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 12px" }}>Jalan pintas</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, fontSize: 14 }}>
              <li><Link href="/guru/scanner" style={{ fontWeight: 700, color: "#171716" }}>Pindai QR kehadiran →</Link></li>
              <li><Link href="/guru/kehadiran" style={{ fontWeight: 700, color: "#171716" }}>Rekap kehadiran →</Link></li>
              <li><Link href="/guru/asesmen" style={{ fontWeight: 700, color: "#171716" }}>Asesmen →</Link></li>
              <li><Link href="/guru/rapor" style={{ fontWeight: 700, color: "#171716" }}>Rapor →</Link></li>
            </ul>
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
