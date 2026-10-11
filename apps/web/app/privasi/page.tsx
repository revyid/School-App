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
          <h2 style={{ fontSize: 18, color: "#171716", marginTop: 24, marginBottom: 8 }}>4. Asisten AI dan pemrosesan pihak ketiga</h2>
          <p>
            Fitur chat AI dinonaktifkan secara default. Jika diaktifkan oleh konfigurasi layanan dan administrator sekolah, pertanyaan yang dikirim melalui chat akan diproses oleh penyedia model AI pihak ketiga yang dikonfigurasi. Secara default, konteks pribadi siswa—seperti profil, tugas, nilai, atau kehadiran—tidak dikirim ke penyedia tersebut. Pengiriman konteks data siswa hanya diizinkan jika fitur berbagi data AI diaktifkan oleh administrator sekolah dan juga diizinkan secara eksplisit oleh konfigurasi server. Nama siswa dan pengenal langsung tidak dimasukkan ke prompt sistem. Pengguna sebaiknya tidak menuliskan data pribadi sensitif di pertanyaan chat.
          </p>
          <p>
            Admin sekolah dapat meninjau dan mengubah pengaturan AI di halaman Pengaturan Sekolah. Pengaturan tersebut tidak dapat melewati konfigurasi keamanan server. Jika AI atau berbagi konteks dinonaktifkan, permintaan AI tidak akan diproses atau konteks siswa tidak akan diteruskan ke penyedia model.
          </p>
        </div>
      </main>
    </div>
  );
}
