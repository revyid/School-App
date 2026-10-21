import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getPageAuth } from "@/app/lib/require-page";
import { isRootHost } from "@lacakedu/shared/school";

// F4: hanya membaca hasil cache getPageAuth + cek peran (tanpa query ulang).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Di apex, /admin = form login root (bukan dasbor sekolah) — lewati gate tenant.
  const h = await headers();
  const bare = (h.get("host") ?? "").split(":")[0].trim().toLowerCase();
  const apex = process.env.APEX_DOMAIN ?? "domainmu.id";
  if (isRootHost(bare, apex)) return <>{children}</>;
  const a = await getPageAuth();
  if (!a.ok) redirect(a.redirectTo);
  if (a.me.role !== "ADMIN") redirect(a.home);
  return <>{children}</>;
}
