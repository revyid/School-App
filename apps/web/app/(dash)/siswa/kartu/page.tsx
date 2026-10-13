import { redirect } from "next/navigation";

// FASE 2: kartu QR pindah ke Profil (KartuSection) — URL lama dialihkan.
export default function SiswaKartuRedirect() {
  redirect("/siswa/profil");
}
