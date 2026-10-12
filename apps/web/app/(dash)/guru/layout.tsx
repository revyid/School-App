import { redirect } from "next/navigation";
import { getPageAuth } from "@/app/lib/require-page";

// F4: hanya membaca hasil cache getPageAuth + cek peran (tanpa query ulang).
export default async function GuruLayout({ children }: { children: React.ReactNode }) {
  const a = await getPageAuth();
  if (!a.ok) redirect(a.redirectTo);
  if (a.me.role !== "GURU") redirect(a.home);
  return <>{children}</>;
}
