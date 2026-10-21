import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { db } from "@lacakedu/db/client";
import { runAsSchool } from "@lacakedu/db/tenant";
import { headers } from "next/headers";
import PublicHeader from "@/components/PublicHeader";
import PetaLoader from "./PetaLoader";

export const metadata = {
  title: "Pembuat Peta Digital — Tools Lacakedu",
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
    const s = await db.school.findFirst({ where: { slug }, select: { id: true, name: true } });
    if (s) {
      schoolName = s.name;
      try {
        const st = await runAsSchool(db, s.id, (tx) =>
          tx.schoolSettings.findUnique({ where: { schoolId: s.id }, select: { portalName: true } }));
        if (st?.portalName) schoolName = st.portalName;
      } catch { /* fallback ke nama sekolah */ }
    }
  }

  return (
    <div style={{ background: "#f7f4ec", minHeight: "100vh", color: "#171716" }}>
      <PublicHeader schoolName={schoolName} />
      <PetaLoader />
    </div>
  );
}
