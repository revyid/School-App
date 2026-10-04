import { LogoutButton } from "@/components/LogoutButton";
import GuruDashboard from "./dashboard";

export default function GuruPage() {
  return (
    <main>
      <h1>Dasbor Guru</h1>
      <GuruDashboard />
      <p>
        <a href="/change-password">Ganti kata sandi</a>
      </p>
      <LogoutButton />
    </main>
  );
}
