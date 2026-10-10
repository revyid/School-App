import PublicHeader from "@/components/PublicHeader";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";

export default async function PrivasiPage() {
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
        <p className="kicker" style={{ color: "#e85e43" }}>Perlindungan Data</p>
        <h1 className="display" style={{ fontSize: 36, margin: "8px 0 24px" }}>
          Kebijakan Privasi (UU PDP No. 27/2022)
        </h1>
        <div className="card" style={{ padding: 32, lineHeight: 1.8, fontSize: 14.5, color: "#444" }}>
          <p>
            {schoolName} berkomitmen penuh melindungi hak privasi dan data pribadi peserta didik, pengajar, serta tenaga kependidikan sesuai Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP).
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>1. Data Yang Dikumpulkan</h2>
          <p>
            Kami mengumpulkan data pendidikan terbatas berupa nama, NISN/Email, foto presensi, catatan kehadiran, tugas, serta nilai untuk kepentingan penyelenggaraan pendidikan.
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>2. Tujuan Pemrosesan Data</h2>
          <p>
            Data pribadi hanya diproses untuk pengelolaan pembelajaran, pelaporan akademik internal, keamanan lingkungan sekolah, dan pemenuhan regulasi Kementerian Pendidikan.
          </p>
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>3. Keamanan & Kerahasiaan</h2>
          <p>
            Data disimpan dalam basis data terenkripsi dan terisolasi per sekolah. Data Anda tidak pernah dijual, disewakan, atau dibagikan kepada pihak ketiga tanpa persetujuan eksplisit.
          </p>
        </div>
      </main>
    </div>
  );
}