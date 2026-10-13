import { redirect } from "next/navigation";

// FASE 2: halaman tugas digabung ke Kelasku — URL lama dialihkan.
export default function SiswaTugasRedirect() {
  redirect("/siswa/kelasku");
}
