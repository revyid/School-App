import { LogoutButton } from "@/components/LogoutButton";
import SiswaDashboard from "./dashboard";

export default function SiswaPage() {
  return (
    <main>
      <h1>Dasbor Siswa</h1>
      <SiswaDashboard />
      <p>
        <a href="/change-password">Ganti kata sandi</a>
      </p>
      <LogoutButton />
    </main>
  );
}
