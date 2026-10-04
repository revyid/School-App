import { LogoutButton } from "@/components/LogoutButton";

export default function SiswaPage() {
  return (
    <main>
      <h1>Dasbor Siswa</h1>
      <p>Modul tugas, kehadiran, dan nilai menyusul di fase berikutnya.</p>
      <p>
        <a href="/change-password">Ganti kata sandi</a>
      </p>
      <LogoutButton />
    </main>
  );
}
