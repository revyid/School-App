import { LogoutButton } from "@/components/LogoutButton";

export default function GuruPage() {
  return (
    <main>
      <h1>Dasbor Guru</h1>
      <p>Modul absensi, tugas, dan penilaian menyusul di fase berikutnya.</p>
      <p>
        <a href="/change-password">Ganti kata sandi</a>
      </p>
      <LogoutButton />
    </main>
  );
}
