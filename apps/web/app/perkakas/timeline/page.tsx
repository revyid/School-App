import { schoolSlugFromHost } from "@sms/shared/school";
import { db } from "@sms/db/client";
import { headers } from "next/headers";
import PublicHeader from "@/components/PublicHeader";
import TimelineLoader from "./TimelineLoader";

export const metadata = {
  title: "Generator Timeline PNG — Tools SMS-LMS",
  description:
    "Buat infografis timeline vertikal atau horizontal (terang/gelap, transparan) lalu unduh sebagai gambar PNG resolusi tinggi.",
};

export default async function TimelinePage() {
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
      <TimelineLoader />
    </div>
  );
}
