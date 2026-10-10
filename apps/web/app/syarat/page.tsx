import PublicHeader from "@/components/PublicHeader";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";

export default async function SyaratPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
  let schoolName = "Sekolah";
  if (slug) {
    const s = await db.school.findFirst({ where: { slug }, select: { name: true } });
    if (s?.name) schoolName = s.name;
  }

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />
      <main style={{ maxWidth: 840, margin: "0 auto", padding: "48px 24px 72px" }}>
        <p className="kicker" style={{ color: "#e85e43" }}>Dokumen Legal</p>
        <h1 className="display" style={{ fontSize: 36, margin: "8px 0 24px" }}>
          Syarat Ketentuan & Penggunaan Layanan
        </h1>
        <div className="card" style={{ padding: 32, lineHeight: 1.8, fontSize: 14.5, color: "#444" }}>
          <p>
            Selamat datang di platform sistem manajemen sekolah {schoolName}. Dengan mengakses atau menggunakan aplikasi ini, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan di bawah ini.
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>1. Penggunaan Akun</h2>
          <p>
            Setiap pengguna (Siswa, Guru, dan Admin) bertanggung jawab penuh menjaga kerahasiaan kata sandi dan aktivitas yang dilakukan melalui akun masing-masing.
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>2. Hak & Kewajiban</h2>
          <p>
            Platform ini digunakan secara khusus untuk mendukung kegiatan akademik, presensi, penugasan, dan komunikasi internal {schoolName}. Dilarang menyalahgunakan akun untuk tindakan ilegal, penipuan, atau perusakan data.
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>3. Pembatalan & Pemblokiran</h2>
          <p>
            Pihak sekolah berhak menonaktifkan atau membatasi akses akun yang terbukti melanggar tata tertib atau menyalahgunakan fasilitas digital sekolah.
          </p>
        </div>
      </main>
    </div>
  );
}