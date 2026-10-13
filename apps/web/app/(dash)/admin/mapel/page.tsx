import { redirect } from "next/navigation";

// Admin Mapel dilebur ke Jadwal (Fase 4): daftar mapel per kelas =
// distinct slot jadwal, penugasan guru disinkron dari jadwal.
export default function MapelRedirect() {
  redirect("/admin/jadwal?dari=mapel");
}
