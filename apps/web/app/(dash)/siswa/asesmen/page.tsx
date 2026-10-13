import { redirect } from "next/navigation";

// FASE 2: halaman asesmen digabung ke Kelasku — URL lama dialihkan.
export default function SiswaAsesmenRedirect() {
  redirect("/siswa/kelasku");
}
