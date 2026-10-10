import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";
import PublicHeader from "@/components/PublicHeader";
import PetaLoader from "./PetaLoader";

export const metadata = {
  title: "Pembuat Peta Digital — Tools SMS-LMS",
  description:
    "Buat peta rute animasi: kamera ikuti kendaraan atau pas di layar, jalur darat atau air, kendaraan per lokasi, ekspor MP4/PNG.",
};

export default async function PetaPage() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const slug = schoolSlugFromHost(host, apex);

  let schoolName = "Portal Sekolah";
  if (slug) {
    const s = await db.school.findFirst({ where: { slug }, select: { name: true } });
    if (s?.name) schoolName = s.name;
  }

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />
      <PetaLoader />
    </div>
  );
}
