import { schoolSlugFromHost } from "@lacakedu/shared/school";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPublicSchool } from "@/lib/public-cache";
import BukuReader from "./BukuReader";

// /buku/[id] — pembaca buku sekolah (markdown, pdf, teks, tautan).
export default async function BukuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await headers();
  const host = h.get("host") ?? "";
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  const slug = schoolSlugFromHost(host, apex);
  if (!slug) redirect("/login");
  const school = await getPublicSchool(slug);
  if (!school) redirect("/login");
  return <BukuReader id={id} schoolName={school.portalName} />;
}
