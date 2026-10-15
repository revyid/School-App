import { redirect } from "next/navigation";

export default function ImportPage() {
  redirect("/admin/pengguna?tab=siswa");
}
