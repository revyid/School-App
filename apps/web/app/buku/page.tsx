import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BukuClient from "./BukuClient";

// /buku — halaman rak bacaan publik (tanpa login, per sekolah).
// Guest: daftar populer + cari. Hasil cari menaut ke Open Library.
// User login tetap boleh membaca; CTA di halaman beralih ke dasbor.
export default async function BukuPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const slug = schoolSlugFromHost(host, apex);
  if (!slug) redirect("/login");
  const school = await db.school.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!school) redirect("/login");
  return <BukuClient schoolName={school.name} />;
}
