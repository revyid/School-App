import { redirect } from "next/navigation";

// FASE 3 guru: /guru/asesmen dilebur ke /guru/tugas (tab Tugas|Asesmen).
export default function GuruAsesmenRedirect() {
  redirect("/guru/tugas?jenis=asesmen");
}
