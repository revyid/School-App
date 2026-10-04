import { LogoutButton } from "@/components/LogoutButton";

export default function AdminPage() {
  return (
    <main>
      <h1>Dasbor Admin</h1>
      <p>Modul master data, jadwal, dan laporan menyusul di fase berikutnya.</p>
      <p>
        <a href="/change-password">Ganti kata sandi</a>
      </p>
      <LogoutButton />
    </main>
  );
}
