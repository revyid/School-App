import { headers } from "next/headers";
import LegalShell from "@/components/LegalShell";
import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";

// Syarat layanan. Sengaja DIPISAH dari kebijakan privasi (Pasal 22 UU PDP):
// persetujuan pemrosesan data pribadi bukan bagian dari perjanjian ini.
export default async function SyaratPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
  let schoolName = "Sekolah";

  if (slug) {
    const s = await db.school.findFirst({ where: { slug }, select: { id: true, name: true } });
    if (s) schoolName = s.name;
  }

  const contact = process.env.PRIVACY_CONTACT_EMAIL?.trim() || null;
  const contactNode = contact
    ? <a href={`mailto:${contact}`}>{contact}</a>
    : <>administrator {schoolName}</>;

  return (
    <LegalShell
      schoolName={schoolName}
      kicker="Dokumen Legal"
      title="Syarat Layanan"
    >
      <p>
        Syarat ini mengatur penggunaan platform sistem manajemen sekolah milik{" "}
        <strong>{schoolName}</strong>. Dengan masuk atau menggunakan layanan, Anda menyatakan telah
        membaca dan menyetujui syarat ini. Bila Anda tidak setuju, jangan gunakan layanan.
      </p>

      <h2>1. Ruang lingkup</h2>
      <p>
        Layanan disediakan untuk mendukung kegiatan akademik {schoolName}: presensi, penugasan,
        penilaian, komunikasi internal, dan layanan pendukung lain yang diaktifkan sekolah. Akun
        hanya diberikan kepada siswa, guru, tenaga kependidikan, dan administrator yang berwenang.
      </p>

      <h2>2. Akun dan keamanan</h2>
      <ul>
        <li>Satu akun untuk satu orang. Akun tidak boleh dipinjamkan atau dialihkan.</li>
        <li>Anda bertanggung jawab menjaga kerahasiaan kata sandi dan seluruh aktivitas pada akun Anda.</li>
        <li>Segera laporkan dugaan akses tidak sah kepada administrator sekolah.</li>
        <li>Kata sandi awal wajib diganti pada penggunaan pertama bila diminta sistem.</li>
      </ul>

      <h2>3. Penggunaan yang dilarang</h2>
      <ul>
        <li>Mengakses data milik orang lain atau sekolah lain tanpa hak.</li>
        <li>Mengunggah konten melanggar hukum, melecehkan, atau mengandung malware.</li>
        <li>Mencoba menembus, membebani, atau mengganggu keamanan dan ketersediaan layanan.</li>
        <li>Mengambil data secara massal (scraping) tanpa izin tertulis sekolah.</li>
        <li>Memalsukan identitas, kehadiran, nilai, atau dokumen sekolah.</li>
      </ul>

      <h2>4. Konten pengguna dan kekayaan intelektual</h2>
      <p>
        Anda tetap memiliki hak atas karya yang Anda unggah. Dengan mengunggahnya, Anda memberi
        sekolah izin terbatas untuk menyimpan, menampilkan, dan menilai konten tersebut semata-mata
        untuk keperluan pendidikan. Perangkat lunak, merek, dan materi milik sekolah tetap menjadi
        hak sekolah atau pemberi lisensinya.
      </p>

      <h2>5. Data pribadi</h2>
      <p>
        Pemrosesan data pribadi diatur dalam <a href="/privasi">Kebijakan Privasi</a>, yang merupakan
        dokumen terpisah dari Syarat Layanan ini. Persetujuan atas pemrosesan data pribadi tidak
        menjadi syarat sahnya perjanjian ini dan dapat ditarik sesuai ketentuan UU PDP.
      </p>

      <h2>6. Ketersediaan dan perubahan layanan</h2>
      <p>
        Layanan dapat dihentikan sementara untuk pemeliharaan, pembaruan, atau alasan keamanan.
        Sekolah dapat menambah, mengubah, atau menghentikan fitur dengan pemberitahuan yang wajar.
        Sekolah berupaya menjaga ketersediaan, tetapi tidak menjamin layanan bebas gangguan.
      </p>

      <h2>7. Penangguhan dan penghentian akun</h2>
      <p>
        Sekolah dapat membatasi atau menonaktifkan akun yang melanggar syarat ini, tata tertib
        sekolah, atau peraturan perundang-undangan. Setelah siswa lulus, berhenti, atau akun tidak
        lagi diperlukan, akses dinonaktifkan dan data ditangani sesuai Kebijakan Privasi.
      </p>

      <h2>8. Batasan tanggung jawab</h2>
      <p>
        Sepanjang diizinkan hukum, sekolah tidak bertanggung jawab atas kerugian tidak langsung yang
        timbul dari penggunaan layanan di luar kendalinya, termasuk gangguan jaringan pihak ketiga.
        Ketentuan ini tidak mengurangi hak Anda yang dijamin oleh undang-undang.
      </p>

      <h2>9. Hukum yang berlaku dan penyelesaian sengketa</h2>
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Sengketa diselesaikan terlebih dahulu
        secara musyawarah; bila tidak tercapai, diselesaikan melalui pengadilan yang berwenang di
        Indonesia.
      </p>

      <h2>10. Kontak</h2>
      <p>Pertanyaan tentang syarat ini dapat disampaikan kepada {contactNode}.</p>
    </LegalShell>
  );
}
