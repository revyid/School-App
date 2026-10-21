import { headers } from "next/headers";
import LegalShell from "@/components/LegalShell";
import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { getPublicLegal } from "@/lib/public-cache";

// Teks mengikuti UU No. 27/2022 (UU PDP). Yang ditulis HANYA yang benar-benar
// dilakukan sistem — jangan menambah klaim keamanan yang tidak bisa dibuktikan.
export default async function PrivasiPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const slug = schoolSlugFromHost(host, process.env.APEX_DOMAIN ?? "localtest.me");
  // Nama sekolah + kebijakan khusus di-cache per slug (tag school:<slug>).
  const legal = slug ? await getPublicLegal(slug) : null;
  const schoolName = legal?.portalName ?? "Sekolah";
  const custom = legal?.policy
    ? { text: legal.policy.text, updatedAt: new Date(legal.policy.updatedAt) }
    : null;

  const contact = process.env.PRIVACY_CONTACT_EMAIL?.trim() || null;
  const contactNode = contact
    ? <a href={`mailto:${contact}`}>{contact}</a>
    : <>administrator sekolah melalui kanal resmi {schoolName}</>;

  return (
    <LegalShell
      schoolName={schoolName}
      kicker="Pelindungan Data Pribadi"
      title="Kebijakan Privasi"
      updatedAt={custom?.updatedAt}
    >
      <p>
        <strong>{schoolName}</strong> adalah pengendali data pribadi untuk layanan ini. Kebijakan ini
        menjelaskan data apa yang kami proses, dasar hukumnya, berapa lama disimpan, dan hak Anda
        sebagai subjek data menurut Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data
        Pribadi (UU PDP). Kebijakan ini merupakan dokumen yang <strong>terpisah</strong> dari Syarat
        Layanan.
      </p>

      <h2>1. Ringkasan</h2>
      <ul>
        <li>Kami hanya memproses data yang diperlukan untuk penyelenggaraan pendidikan.</li>
        <li>Tidak ada iklan, pelacakan pemasaran, atau penjualan data pribadi.</li>
        <li>Data disimpan terpisah per sekolah dan hanya dapat diakses sesuai peran.</li>
        <li>Permintaan terkait hak Anda dilayani paling lambat <strong>3×24 jam</strong>.</li>
      </ul>

      {custom ? (
        <>
          <h2>2. Ketentuan khusus {schoolName}</h2>
          {custom.text.split(/\n{2,}/).map((par, i) => <p key={i}>{par}</p>)}
        </>
      ) : null}

      <h2>{custom ? 3 : 2}. Data pribadi yang kami proses</h2>
      <ul>
        <li><strong>Identitas akun:</strong> nama, email atau NISN, peran, dan kelas. Kata sandi disimpan sebagai hash Argon2id, bukan teks asli.</li>
        <li><strong>Profil siswa:</strong> jenis kelamin, tanggal lahir, nomor telepon orang tua/wali, foto profil, dan bio.</li>
        <li><strong>Kehadiran:</strong> status, waktu, sumber pencatatan (pindai QR atau manual), serta kode QR pribadi siswa.</li>
        <li><strong>Akademik:</strong> tugas, berkas yang diunggah, jawaban, nilai, dan hasil asesmen.</li>
        <li><strong>Izin/tidak hadir:</strong> tanggal, keterangan, serta <em>foto siswa dan foto orang tua/wali</em> yang diambil langsung dari kamera.</li>
        <li><strong>Komunikasi:</strong> notifikasi, pengumuman, pesan kolaborasi, dan pesan WhatsApp bila fitur itu diaktifkan sekolah.</li>
        <li><strong>Chat AI:</strong> riwayat percakapan (maksimal 50 pesan terakhir), hanya bila fitur diaktifkan.</li>
        <li><strong>Langganan notifikasi push:</strong> endpoint perangkat, kunci enkripsi, dan jenis peramban.</li>
        <li><strong>Log keamanan:</strong> waktu, jenis peristiwa autentikasi, dan alamat IP.</li>
      </ul>
      <p>
        Sebagian termasuk <strong>data pribadi bersifat spesifik</strong> menurut Pasal 4 ayat (2) UU
        PDP, yaitu <strong>data anak</strong> dan <strong>foto</strong> siswa.
      </p>

      <h2>{custom ? 4 : 3}. Dasar hukum dan tujuan pemrosesan</h2>
      <ul>
        <li><strong>Penyelenggaraan pendidikan:</strong> presensi, penugasan, penilaian, dan pelaporan akademik.</li>
        <li><strong>Kewajiban hukum:</strong> penyimpanan catatan pendidikan yang diwajibkan peraturan perundang-undangan.</li>
        <li><strong>Persetujuan:</strong> foto izin, chat AI, dan notifikasi push. Persetujuan dapat ditarik kapan saja.</li>
        <li><strong>Kepentingan yang sah:</strong> keamanan sistem, pencegahan penyalahgunaan, dan audit akses.</li>
      </ul>

      <h2>{custom ? 5 : 4}. Data anak dan persetujuan orang tua/wali</h2>
      <p>
        Sebagian besar siswa berusia di bawah 18 tahun. Sesuai Pasal 25 UU PDP, pemrosesan data anak
        memerlukan persetujuan orang tua atau wali. Sekolah mencatat persetujuan tersebut, dan fitur
        pengambilan foto izin tidak dapat digunakan sebelum persetujuan tercatat.
      </p>
      <p>
        Persetujuan dapat ditarik kapan saja melalui wali kelas atau administrator sekolah. Setelah
        penarikan, pemrosesan yang bersandar pada persetujuan dihentikan paling lambat 3×24 jam,
        tanpa memengaruhi keabsahan pemrosesan sebelumnya.
      </p>

      <h2>{custom ? 6 : 5}. Penyimpanan dan masa retensi</h2>
      <ul>
        <li><strong>Foto izin:</strong> dihapus otomatis setelah <strong>30 hari</strong> (dapat diatur sekolah).</li>
        <li><strong>Sesi login:</strong> berlaku <strong>7 hari</strong>, diperpanjang selama aktif.</li>
        <li><strong>Riwayat chat AI:</strong> hanya 50 pesan terakhir per akun.</li>
        <li><strong>Data akademik, tugas, materi, lampiran (avatar, sketsa, karya siswa),</strong> dan kehadiran: disimpan selama siswa terdaftar. <strong>Tidak dihapus otomatis</strong> — sekolah menghapusnya secara manual dari admin apabila tidak lagi diperlukan.</li>
        <li><strong>Log keamanan autentikasi:</strong> disimpan untuk keperluan keamanan dan audit.</li>
      </ul>
      <p>
        Foto izin, sesi, dan riwayat chat AI dihapus otomatis sesuai batas di atas. Data akademik,
        tugas, materi, lampiran, dan kehadiran <strong>tidak dihapus otomatis</strong> — mereka
        disimpan selama siswa terdaftar dan tetap diperlukan, atau dihapus oleh sekolah
        secara manual ketika tidak lagi diperlukan (contoh: lulus/berhenti). Penghapusan atas
        permintaan subjek data tetap berlaku bagi data yang tidak lagi diperlukan (Pasal 8, 45).
      </p>

      <h2>{custom ? 7 : 6}. Pihak ketiga dan transfer data</h2>
      <p>Kami tidak menjual atau menyewakan data pribadi. Data dapat melewati atau diproses oleh:</p>
      <ul>
        <li><strong>Cloudflare</strong> — jalur jaringan dan TLS; trafik melewati jaringan global mereka.</li>
        <li><strong>Penyedia model AI</strong> — hanya jika chat AI diaktifkan administrator sekolah.</li>
        <li><strong>WhatsApp</strong> — hanya jika notifikasi WhatsApp diaktifkan; nomor dan isi pesan diproses untuk pengiriman.</li>
        <li><strong>Layanan push peramban</strong> (mis. Google, Mozilla, Apple) — hanya jika notifikasi push diaktifkan.</li>
        <li><strong>OpenStreetMap</strong> dan <strong>Open Library</strong> — peta dan sampul buku; permintaan mengirimkan alamat IP dan referer.</li>
      </ul>
      <p>
        Sebagian pihak tersebut memproses data di luar Indonesia. Transfer lintas negara dilakukan
        dengan memastikan tingkat pelindungan yang setara sebagaimana dimaksud Pasal 56 UU PDP.
        Untuk fitur AI, konteks pribadi siswa tidak dikirim kecuali administrator sekolah
        mengaktifkannya secara eksplisit; nama dan pengenal langsung tidak dimasukkan ke prompt.
      </p>

      <h2>{custom ? 8 : 7}. Keamanan</h2>
      <ul>
        <li>Koneksi dienkripsi dengan TLS 1.2/1.3.</li>
        <li>Kata sandi di-hash dengan Argon2id dan tidak pernah dikirim ke peramban.</li>
        <li>Isolasi data per sekolah (Row Level Security) dan kontrol akses berbasis peran.</li>
        <li>Pembatasan percobaan login dan pencatatan audit peristiwa autentikasi.</li>
        <li>Kredensial server dan kunci API hanya berada di sisi server.</li>
      </ul>

      <h2>{custom ? 9 : 8}. Hak Anda sebagai subjek data</h2>
      <p>Anda berhak, dan kami layani paling lambat 3×24 jam sejak permintaan diterima:</p>
      <ul>
        <li><strong>Akses dan salinan</strong> data pribadi Anda (Pasal 7 dan 32).</li>
        <li><strong>Perbaikan dan pembaruan</strong> data yang tidak akurat (Pasal 6 dan 30).</li>
        <li><strong>Penarikan persetujuan</strong> (Pasal 9 dan 40).</li>
        <li><strong>Penghentian, penundaan, atau pembatasan</strong> pemrosesan (Pasal 11 dan 41).</li>
        <li><strong>Penghapusan dan pemusnahan</strong> data (Pasal 8, 43, dan 45), dengan konfirmasi tertulis.</li>
        <li><strong>Portabilitas</strong> data dalam format terstruktur yang umum dibaca mesin (Pasal 13).</li>
        <li><strong>Keberatan atas keputusan otomatis</strong> (Pasal 10). Sistem ini tidak melakukan pemrofilan yang menimbulkan akibat hukum; nilai ditetapkan oleh guru.</li>
      </ul>

      <h2>{custom ? 10 : 9}. Insiden kegagalan pelindungan data</h2>
      <p>
        Bila terjadi kebocoran atau kegagalan pelindungan data pribadi, kami memberitahukan subjek
        data yang terdampak dan lembaga pengawas paling lambat <strong>3×24 jam</strong>, memuat
        jenis data yang terdampak, waktu dan penyebab insiden, serta langkah penanganan dan kontak
        yang dapat dihubungi (Pasal 46).
      </p>

      <h2>{custom ? 11 : 10}. Perubahan kebijakan</h2>
      <p>
        Perubahan tujuan atau cakupan pemrosesan akan diinformasikan lebih dahulu melalui layanan
        atau kanal resmi sekolah. Tanggal pembaruan tercantum di bagian atas halaman ini.
      </p>

      <h2>{custom ? 12 : 11}. Kontak</h2>
      <p>
        Pertanyaan, permintaan hak subjek data, atau laporan insiden dapat disampaikan kepada {contactNode}.
      </p>
    </LegalShell>
  );
}
